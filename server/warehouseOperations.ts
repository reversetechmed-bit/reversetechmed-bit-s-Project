export type OperationalPart = {
  id: number;
  partNumber: string;
  name: string;
  quantity: number;
  reservedQuantity: number;
  minimumStock: number;
  warehouseSection: "components" | "products";
};

export type OperationalMaintenanceCase = {
  id: number;
  caseNumber: string;
  type: "maintenance_outbound" | "customer_return";
  status: "open" | "sent_for_maintenance" | "awaiting_inspection" | "returned_to_stock" | "closed" | "cancelled";
  quantity: number;
};

export function prepareMaintenanceDispatch(record: { maintenanceCase: OperationalMaintenanceCase; part: OperationalPart }, actorId: number, dispatchedAt = new Date()) {
  if (record.maintenanceCase.type !== "maintenance_outbound" || record.maintenanceCase.status !== "open") {
    return { ok: false as const, reason: "يمكن إرسال حالات الصيانة الخارجية المفتوحة فقط." };
  }
  const availableQuantity = record.part.quantity - record.part.reservedQuantity;
  if (record.maintenanceCase.quantity > availableQuantity) {
    return { ok: false as const, reason: `الكمية المتاحة للصيانة هي ${availableQuantity} فقط.` };
  }
  const quantityAfter = record.part.quantity - record.maintenanceCase.quantity;
  return {
    ok: true as const,
    dispatchedAt,
    quantityAfter,
    transaction: {
      partId: record.part.id,
      maintenanceCaseId: record.maintenanceCase.id,
      type: "maintenance_dispatched" as const,
      quantityDelta: -record.maintenanceCase.quantity,
      quantityBefore: record.part.quantity,
      quantityAfter,
      actorId,
      partNumberSnapshot: record.part.partNumber,
      partNameSnapshot: record.part.name,
      warehouseSectionSnapshot: record.part.warehouseSection,
      details: `تم إخراج ${record.maintenanceCase.quantity} × ${record.part.name} للصيانة تحت الرقم ${record.maintenanceCase.caseNumber}.`,
    },
  };
}

export function prepareMaintenanceReceipt(record: { maintenanceCase: OperationalMaintenanceCase; part: OperationalPart }, actorId: number, returnedAt = new Date()) {
  const canReceive = record.maintenanceCase.type === "maintenance_outbound"
    ? record.maintenanceCase.status === "sent_for_maintenance"
    : record.maintenanceCase.status === "awaiting_inspection";
  if (!canReceive) {
    return { ok: false as const, reason: "لا يمكن إضافة هذه الحالة إلى المخزون في وضعها الحالي." };
  }
  const quantityAfter = record.part.quantity + record.maintenanceCase.quantity;
  return {
    ok: true as const,
    returnedAt,
    quantityAfter,
    transaction: {
      partId: record.part.id,
      maintenanceCaseId: record.maintenanceCase.id,
      type: "maintenance_returned" as const,
      quantityDelta: record.maintenanceCase.quantity,
      quantityBefore: record.part.quantity,
      quantityAfter,
      actorId,
      partNumberSnapshot: record.part.partNumber,
      partNameSnapshot: record.part.name,
      warehouseSectionSnapshot: record.part.warehouseSection,
      details: `تمت إعادة ${record.maintenanceCase.quantity} × ${record.part.name} إلى المخزون من الحالة ${record.maintenanceCase.caseNumber}.`,
    },
  };
}

type EscalationPart = Pick<OperationalPart, "id" | "name" | "quantity" | "reservedQuantity" | "minimumStock" | "warehouseSection">;
type EscalationRequest = { id: number; status: "pending" | "approved" | "rejected" | "delivered"; createdAt: Date; partId: number };
type EscalationInvoice = { id: number; invoiceNumber: string; issuedAt: Date; receiptConfirmedAt: Date | null; requestId: number; partId: number };

export type OperationalEscalation = {
  type: "low_stock" | "overdue_request" | "receipt_confirmation_pending";
  title: string;
  body: string;
  partId: number;
  requestId?: number;
  dedupeKey: string;
};

/** Builds deterministic escalation intents. Persistence is deliberately handled by the caller. */
export function buildOperationalEscalations(input: { parts: EscalationPart[]; requests: EscalationRequest[]; invoices: EscalationInvoice[]; now?: Date }) {
  const now = input.now ?? new Date();
  const day = now.toISOString().slice(0, 10);
  const overdueBefore = now.getTime() - 48 * 60 * 60 * 1000;
  const receiptDueBefore = now.getTime() - 24 * 60 * 60 * 1000;
  const partById = new Map(input.parts.map(part => [part.id, part]));
  const alerts: OperationalEscalation[] = [];

  for (const part of input.parts) {
    if (part.quantity - part.reservedQuantity <= part.minimumStock) {
      const section = part.warehouseSection === "products" ? "المنتجات" : "المكونات";
      alerts.push({
        type: "low_stock",
        title: `${section}: تنبيه رصيد منخفض`,
        body: `الرصيد المتاح من ${part.name} وصل إلى الحد الأدنى أو أقل ويحتاج متابعة شراء.`,
        partId: part.id,
        dedupeKey: `low-stock:${part.id}:${day}`,
      });
    }
  }

  for (const request of input.requests) {
    if ((request.status === "pending" || request.status === "approved") && request.createdAt.getTime() <= overdueBefore) {
      const part = partById.get(request.partId);
      if (!part) continue;
      alerts.push({
        type: "overdue_request",
        title: "طلب صرف متأخر يحتاج متابعة",
        body: `طلب ${part.name} ما زال ${request.status === "pending" ? "بانتظار المراجعة" : "معتمدًا بانتظار التسليم"} منذ أكثر من 48 ساعة.`,
        partId: part.id,
        requestId: request.id,
        dedupeKey: `overdue-request:${request.id}`,
      });
    }
  }

  for (const invoice of input.invoices) {
    if (!invoice.receiptConfirmedAt && invoice.issuedAt.getTime() <= receiptDueBefore) {
      const part = partById.get(invoice.partId);
      if (!part) continue;
      alerts.push({
        type: "receipt_confirmation_pending",
        title: "تأكيد استلام معلق",
        body: `الفاتورة ${invoice.invoiceNumber} الخاصة بـ ${part.name} بانتظار تأكيد الاستلام الرقمي منذ أكثر من 24 ساعة.`,
        partId: part.id,
        requestId: invoice.requestId,
        dedupeKey: `receipt-pending:${invoice.id}`,
      });
    }
  }
  return alerts;
}
