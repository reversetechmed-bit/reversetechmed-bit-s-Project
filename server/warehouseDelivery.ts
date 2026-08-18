import { isLowStock, validateDelivery } from "./warehouseRules";

export type DeliveryRecord = {
  request: { id: number; status: string; requestedQuantity: number; requestedById: number; purpose: string };
  part: { id: number; partNumber: string; name: string; quantity: number; minimumStock: number; warehouseSection: "components" | "products" };
  engineer: { id: number; name: string | null };
};

export type DeliveryTransaction = {
  partId: number;
  requestId: number;
  type: "delivery_confirmed";
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  actorId: number;
  engineerId: number;
  partNumberSnapshot: string;
  partNameSnapshot: string;
  warehouseSectionSnapshot: "components" | "products";
  details: string;
};

export type DeliveryPersistence = {
  updatePartQuantity: (partId: number, quantity: number) => Promise<void>;
  markRequestDelivered: (requestId: number, adminId: number, deliveredAt: Date) => Promise<void>;
  insertTransaction: (transaction: DeliveryTransaction) => Promise<void>;
  createHandoverInvoice: (invoice: { invoiceNumber: string; requestId: number; partId: number; issuedById: number; receivedById: number; partNumberSnapshot: string; partNameSnapshot: string; warehouseSectionSnapshot: "components" | "products"; quantity: number; purposeSnapshot: string; issuedAt: Date }) => Promise<void>;
  recordActivity: (activity: { type: "handover_completed"; actorId: number; title: string; detail: string; requestId: number; partId: number }) => Promise<void>;
  hasUnreadLowStockAlert: (partId: number) => Promise<boolean>;
  createLowStockAlert: (input: { type: "low_stock"; title: string; body: string; partId: number; requestId: number }) => Promise<void>;
};

export function prepareConfirmedDelivery(record: DeliveryRecord, adminId: number, deliveredAt = new Date()) {
  const delivery = validateDelivery(record.request.status, record.part.quantity, record.request.requestedQuantity);
  if (!delivery.ok) return delivery;

  const invoiceNumber = `RT-HO-${deliveredAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(record.request.id).padStart(5, "0")}`;
  return {
    ok: true as const,
    quantityAfter: delivery.quantityAfter,
    deliveredAt,
    shouldCreateLowStockAlert: isLowStock(delivery.quantityAfter, record.part.minimumStock),
    transaction: {
      partId: record.part.id,
      requestId: record.request.id,
      type: "delivery_confirmed" as const,
      quantityDelta: -record.request.requestedQuantity,
      quantityBefore: record.part.quantity,
      quantityAfter: delivery.quantityAfter,
      actorId: adminId,
      engineerId: record.engineer.id,
      partNumberSnapshot: record.part.partNumber,
      partNameSnapshot: record.part.name,
      warehouseSectionSnapshot: record.part.warehouseSection,
      details: `Physically handed over ${record.request.requestedQuantity} unit(s) to ${record.engineer.name || "the requesting engineer"}.`,
    } satisfies DeliveryTransaction,
    invoice: {
      invoiceNumber,
      requestId: record.request.id,
      partId: record.part.id,
      issuedById: adminId,
      receivedById: record.request.requestedById,
      partNumberSnapshot: record.part.partNumber,
      partNameSnapshot: record.part.name,
      warehouseSectionSnapshot: record.part.warehouseSection,
      quantity: record.request.requestedQuantity,
      purposeSnapshot: record.request.purpose,
      issuedAt: deliveredAt,
    },
  };
}

/** Executes the delivery write sequence inside the database transaction supplied by the caller. */
export async function executeConfirmedDelivery(record: DeliveryRecord, adminId: number, persistence: DeliveryPersistence, deliveredAt = new Date()) {
  const plan = prepareConfirmedDelivery(record, adminId, deliveredAt);
  if (!plan.ok) return plan;

  await persistence.updatePartQuantity(record.part.id, plan.quantityAfter);
  await persistence.markRequestDelivered(record.request.id, adminId, plan.deliveredAt);
  await persistence.insertTransaction(plan.transaction);
  await persistence.createHandoverInvoice(plan.invoice);
  await persistence.recordActivity({
    type: "handover_completed",
    actorId: adminId,
    title: "Manual handover completed",
    detail: `${record.request.requestedQuantity} × ${record.part.name} handed to ${record.engineer.name || "the requesting engineer"}. Invoice ${plan.invoice.invoiceNumber}.`,
    requestId: record.request.id,
    partId: record.part.id,
  });
  if (plan.shouldCreateLowStockAlert && !(await persistence.hasUnreadLowStockAlert(record.part.id))) {
    const sectionLabel = record.part.warehouseSection === "products" ? "Products" : "Components";
    await persistence.createLowStockAlert({
      type: "low_stock",
      title: `${sectionLabel}: low stock warning`,
      body: `${record.part.name} in ${sectionLabel} is below its minimum stock threshold after delivery.`,
      partId: record.part.id,
      requestId: record.request.id,
    });
  }
  return plan;
}
