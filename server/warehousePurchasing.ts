export type PurchaseReceiptLine = {
  id: number;
  partId: number;
  quantityOrdered: number;
  quantityReceived: number;
  part: {
    id: number;
    partNumber: string;
    name: string;
    quantity: number;
    warehouseSection: "components" | "products";
  };
};

export function preparePurchaseReceipt(input: {
  orderStatus: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  lines: PurchaseReceiptLine[];
  receiving: Array<{ lineId: number; quantityReceived: number }>;
  actorId: number;
}) {
  if (input.orderStatus !== "ordered" && input.orderStatus !== "partially_received") {
    return { ok: false as const, reason: "يمكن استلام أوامر الشراء المرسلة أو المستلمة جزئيًا فقط." };
  }
  const requestedByLine = new Map<number, number>();
  for (const entry of input.receiving) {
    if (requestedByLine.has(entry.lineId)) return { ok: false as const, reason: "لا يمكن تكرار بند الاستلام نفسه." };
    if (!Number.isInteger(entry.quantityReceived) || entry.quantityReceived <= 0) return { ok: false as const, reason: "كمية الاستلام يجب أن تكون رقمًا صحيحًا موجبًا." };
    requestedByLine.set(entry.lineId, entry.quantityReceived);
  }
  if (!requestedByLine.size) return { ok: false as const, reason: "أضف بند استلام واحدًا على الأقل." };

  const updates: Array<{ line: PurchaseReceiptLine; receivedNow: number; quantityReceivedAfter: number; quantityAfter: number }> = [];
  for (const [lineId, receivedNow] of Array.from(requestedByLine.entries())) {
    const line = input.lines.find(candidate => candidate.id === lineId);
    if (!line) return { ok: false as const, reason: "يوجد بند استلام غير تابع لأمر الشراء." };
    const remaining = line.quantityOrdered - line.quantityReceived;
    if (receivedNow > remaining) return { ok: false as const, reason: `كمية الاستلام من ${line.part.name} تتجاوز المتبقي (${remaining}).` };
    updates.push({ line, receivedNow, quantityReceivedAfter: line.quantityReceived + receivedNow, quantityAfter: line.part.quantity + receivedNow });
  }

  const allReceivedAfter = input.lines.every(line => {
    const update = updates.find(candidate => candidate.line.id === line.id);
    return (update?.quantityReceivedAfter ?? line.quantityReceived) >= line.quantityOrdered;
  });
  return { ok: true as const, updates, nextStatus: allReceivedAfter ? "received" as const : "partially_received" as const };
}
