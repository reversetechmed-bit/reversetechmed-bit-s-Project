export type CustodyEligiblePart = {
  quantity: number;
  reservedQuantity: number;
  custodyQuantity?: number;
};

export function availableInsideWarehouse(part: CustodyEligiblePart) {
  return Math.max(0, part.quantity - part.reservedQuantity - (part.custodyQuantity ?? 0));
}

export function validateCustodyIssue(status: string, part: CustodyEligiblePart, requestedQuantity: number) {
  if (status !== "approved") return { ok: false as const, reason: "يمكن إصدار العُهدة بعد اعتماد الطلب فقط." };
  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) return { ok: false as const, reason: "كمية العُهدة غير صالحة." };
  const availableQuantity = availableInsideWarehouse(part);
  if (requestedQuantity > availableQuantity) return { ok: false as const, reason: `المتاح داخل المخزن لإصدار العُهدة هو ${availableQuantity} فقط.` };
  return { ok: true as const, availableQuantity, custodyQuantityAfter: (part.custodyQuantity ?? 0) + requestedQuantity };
}

export function validateCustodyReturn(currentCustodyQuantity: number, returnedQuantity: number) {
  if (returnedQuantity <= 0 || currentCustodyQuantity < returnedQuantity) return { ok: false as const, reason: "رصيد العُهدة لا يطابق سجل القطعة؛ راجع سجل الحركة." };
  return { ok: true as const, custodyQuantityAfter: currentCustodyQuantity - returnedQuantity };
}
