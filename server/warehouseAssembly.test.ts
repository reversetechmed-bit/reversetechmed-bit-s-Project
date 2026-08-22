import { describe, expect, it } from "vitest";
import { prepareAssemblyCompletion } from "./warehouseAssembly";

const target = { id: 20, partNumber: "RT-FINISHED", name: "منتج تام", quantity: 2, reservedQuantity: 0, warehouseSection: "products" as const, productStage: "finished" as const };
const source = { id: 21, partNumber: "RT-WIP", name: "لوحة تحت التشغيل", quantity: 5, reservedQuantity: 1, warehouseSection: "products" as const, productStage: "work_in_progress" as const };

describe("BOM assembly", () => {
  it("atomically plans source consumption and finished-product output", () => {
    const plan = prepareAssemblyCompletion({ target, bom: [{ componentId: source.id, quantityRequired: 2, source }], quantityToProduce: 2, actorId: 1, assemblyOrderId: 8, assemblyNumber: "RT-ASM-8" });
    expect(plan).toMatchObject({ ok: true, targetQuantityAfter: 4, consumed: [{ quantityConsumed: 4, quantityAfter: 1 }], targetTransaction: { type: "assembly_produced", quantityDelta: 2 } });
    if (plan.ok) expect(plan.sourceTransactions[0]).toMatchObject({ type: "assembly_consumed", quantityDelta: -4 });
  });

  it("rejects assembly when the source has insufficient unreserved stock", () => {
    const plan = prepareAssemblyCompletion({ target, bom: [{ componentId: source.id, quantityRequired: 3, source }], quantityToProduce: 2, actorId: 1, assemblyOrderId: 8, assemblyNumber: "RT-ASM-8" });
    expect(plan).toMatchObject({ ok: false });
  });
});
