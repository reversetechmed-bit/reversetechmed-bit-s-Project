import { describe, expect, it } from "vitest";
import { preparePurchaseReceipt } from "./warehousePurchasing";

const line = { id: 1, partId: 9, quantityOrdered: 10, quantityReceived: 4, part: { id: 9, partNumber: "RT-PLA", name: "بكرة PLA", quantity: 2, warehouseSection: "components" as const } };

describe("purchase order receiving", () => {
  it("supports partial receipt and adds only the received quantity to stock", () => {
    const plan = preparePurchaseReceipt({ orderStatus: "ordered", lines: [line], receiving: [{ lineId: 1, quantityReceived: 3 }], actorId: 1 });
    expect(plan).toMatchObject({ ok: true, nextStatus: "partially_received", updates: [{ quantityReceivedAfter: 7, quantityAfter: 5 }] });
  });

  it("marks the order as fully received only when every line is complete", () => {
    const plan = preparePurchaseReceipt({ orderStatus: "partially_received", lines: [line], receiving: [{ lineId: 1, quantityReceived: 6 }], actorId: 1 });
    expect(plan).toMatchObject({ ok: true, nextStatus: "received", updates: [{ quantityReceivedAfter: 10, quantityAfter: 8 }] });
  });

  it("rejects a receipt that exceeds the remaining supplier quantity", () => {
    const plan = preparePurchaseReceipt({ orderStatus: "ordered", lines: [line], receiving: [{ lineId: 1, quantityReceived: 7 }], actorId: 1 });
    expect(plan).toMatchObject({ ok: false });
  });
});
