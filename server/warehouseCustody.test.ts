import { describe, expect, it } from "vitest";
import { availableInsideWarehouse, validateCustodyIssue, validateCustodyReturn } from "./warehouseCustody";
import { prepareConfirmedDelivery } from "./warehouseDelivery";

describe("warehouse custody rules", () => {
  it("keeps physical stock unchanged but removes active custody from inside-warehouse availability", () => {
    const part = { quantity: 12, reservedQuantity: 3, custodyQuantity: 4 };
    expect(availableInsideWarehouse(part)).toBe(5);
    expect(validateCustodyIssue("approved", part, 2)).toEqual({ ok: true, availableQuantity: 5, custodyQuantityAfter: 6 });
  });

  it("requires an approved request and prevents over-issuing active custody", () => {
    const part = { quantity: 8, reservedQuantity: 2, custodyQuantity: 5 };
    expect(validateCustodyIssue("pending", part, 1)).toEqual({ ok: false, reason: "يمكن إصدار العُهدة بعد اعتماد الطلب فقط." });
    expect(validateCustodyIssue("approved", part, 2)).toEqual({ ok: false, reason: "المتاح داخل المخزن لإصدار العُهدة هو 1 فقط." });
  });

  it("releases only the custody count when an admin confirms a return", () => {
    expect(validateCustodyReturn(4, 3)).toEqual({ ok: true, custodyQuantityAfter: 1 });
    expect(validateCustodyReturn(1, 2)).toEqual({ ok: false, reason: "رصيد العُهدة لا يطابق سجل القطعة؛ راجع سجل الحركة." });
  });

  it("does not allow permanent delivery to consume stock that is currently held in custody", () => {
    const delivery = prepareConfirmedDelivery({
      request: { id: 70, status: "approved", requestedQuantity: 2, requestedById: 8, purpose: "Bench test" },
      part: { id: 8, partNumber: "RT-CUS-08", name: "Custody protected part", warehouseSection: "components", quantity: 4, reservedQuantity: 2, custodyQuantity: 3, minimumStock: 1 },
      engineer: { id: 8, name: "Engineer" },
    }, 1);
    expect(delivery).toEqual({ ok: false, reason: "There is no longer enough inventory to deliver this request." });
  });
});
