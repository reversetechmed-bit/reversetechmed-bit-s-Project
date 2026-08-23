import { describe, expect, it } from "vitest";
import { calculateCountVariance, prepareInventoryCountApproval, validateCountEntry } from "./warehouseInventoryCounts";

const line = (overrides: Partial<Parameters<typeof prepareInventoryCountApproval>[0]["lines"][number]> = {}) => ({
  id: 1,
  expectedQuantity: 10,
  expectedReservedQuantity: 2,
  expectedCustodyQuantity: 1,
  countedQuantity: 8,
  part: { id: 5, quantity: 10, reservedQuantity: 2, custodyQuantity: 1, partNumber: "RT-RES-1", name: "مقاومة", warehouseSection: "components" as const },
  ...overrides,
});

describe("inventory count controls", () => {
  it("records a difference without any stock plan before a submitted session is approved", () => {
    expect(calculateCountVariance(10, 8)).toBe(-2);
    expect(validateCountEntry({ sessionStatus: "open", expectedQuantity: 10, countedQuantity: 8 })).toEqual({ ok: true, varianceQuantity: -2 });
    expect(prepareInventoryCountApproval({ sessionStatus: "open", lines: [line()], actorId: 9, sessionId: 4, countNumber: "RT-COUNT-001" }).ok).toBe(false);
  });

  it("creates audit-ready adjustments only after approval and preserves current stock checks", () => {
    const plan = prepareInventoryCountApproval({ sessionStatus: "submitted", lines: [line()], actorId: 9, sessionId: 4, countNumber: "RT-COUNT-001", now: new Date("2026-08-23T08:00:00.000Z") });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.adjustments).toHaveLength(1);
    expect(plan.adjustments[0]?.transaction).toMatchObject({ type: "inventory_count_adjusted", quantityDelta: -2, quantityBefore: 10, quantityAfter: 8, inventoryCountSessionId: 4 });
  });

  it("refuses to overwrite newer movements or make physical stock lower than commitments", () => {
    const changed = prepareInventoryCountApproval({ sessionStatus: "submitted", lines: [line({ part: { id: 5, quantity: 11, reservedQuantity: 2, custodyQuantity: 1, partNumber: "RT-RES-1", name: "مقاومة", warehouseSection: "components" } })], actorId: 9, sessionId: 4, countNumber: "RT-COUNT-001" });
    expect(changed).toMatchObject({ ok: false });
    const belowCommitments = prepareInventoryCountApproval({ sessionStatus: "submitted", lines: [line({ countedQuantity: 2 })], actorId: 9, sessionId: 4, countNumber: "RT-COUNT-001" });
    expect(belowCommitments).toMatchObject({ ok: false });
  });
});
