import { describe, expect, it } from "vitest";
import { prepareDisassemblyCompletion, prepareProductionWorkOrderCompletion, validateDisassemblySource, validateWorkOrderTransition } from "./warehouseExecution";

const sourceLine = (overrides: Record<string, unknown> = {}) => ({ id: 1, sourcePartId: 2, quantityRequired: 3, quantityConsumed: 0, partNumberSnapshot: "RES-01", partNameSnapshot: "مقاومة", source: { id: 2, quantity: 10, reservedQuantity: 1, custodyQuantity: 1, partNumber: "RES-01", name: "مقاومة", warehouseSection: "components" as const }, ...overrides });

describe("work order and disassembly controls", () => {
  it("does not consume a production BOM until quality-checked completion", () => {
    expect(validateWorkOrderTransition("draft", "released").ok).toBe(true);
    expect(validateWorkOrderTransition("draft", "completed").ok).toBe(false);
    expect(prepareProductionWorkOrderCompletion({ status: "in_progress", target: { id: 8, quantity: 1, partNumber: "PCB-1", name: "لوحة", warehouseSection: "products" }, lines: [sourceLine()], quantityPlanned: 2, workOrderId: 4, workOrderNumber: "RT-WO-1", actorId: 9 }).ok).toBe(false);
  });

  it("consumes BOM and produces the target atomically only when stock is available", () => {
    const plan = prepareProductionWorkOrderCompletion({ status: "quality_check", target: { id: 8, quantity: 1, partNumber: "PCB-1", name: "لوحة", warehouseSection: "products" }, lines: [sourceLine()], quantityPlanned: 2, workOrderId: 4, workOrderNumber: "RT-WO-1", actorId: 9 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.consumed[0]?.quantityAfter).toBe(7);
    expect(plan.targetQuantityAfter).toBe(3);
    expect(plan.targetTransaction).toMatchObject({ type: "work_order_produced", quantityDelta: 2 });
  });

  it("allows only eligible sources and restocks serviceable recovered parts exactly once", () => {
    expect(validateDisassemblySource({ sourceSerialStatus: "in_stock", maintenanceDisposition: null, hasSourcePart: true }).ok).toBe(false);
    expect(validateDisassemblySource({ sourceSerialStatus: "retired", maintenanceDisposition: null, hasSourcePart: true }).ok).toBe(true);
    const plan = prepareDisassemblyCompletion({ status: "approved", sourceSerialAssetId: 2, disassemblyOrderId: 7, disassemblyNumber: "RT-DS-1", actorId: 9, lines: [{ id: 1, recoveredPart: { id: 3, quantity: 4, partNumber: "CAP-1", name: "مكثف", warehouseSection: "components" }, quantityRecovered: 2, condition: "serviceable", quantityRestocked: 0 }, { id: 2, recoveredPart: { id: 4, quantity: 5, partNumber: "PCB-2", name: "لوحة تالفة", warehouseSection: "products" }, quantityRecovered: 1, condition: "scrap", quantityRestocked: 0 }] });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.recovered[0]).toMatchObject({ quantityRestocked: 2, quantityAfter: 6 });
    expect(plan.recovered[1]).toMatchObject({ quantityRestocked: 0, quantityAfter: 5 });
  });
});
