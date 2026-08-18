import { isLowStock, validateDelivery } from "./warehouseRules";

export type DeliveryRecord = {
  request: { id: number; status: string; requestedQuantity: number; requestedById: number };
  part: { id: number; partNumber: string; name: string; quantity: number; minimumStock: number };
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
  details: string;
};

export type DeliveryPersistence = {
  updatePartQuantity: (partId: number, quantity: number) => Promise<void>;
  markRequestDelivered: (requestId: number, adminId: number, deliveredAt: Date) => Promise<void>;
  insertTransaction: (transaction: DeliveryTransaction) => Promise<void>;
  hasUnreadLowStockAlert: (partId: number) => Promise<boolean>;
  createLowStockAlert: (input: { type: "low_stock"; title: string; body: string; partId: number; requestId: number }) => Promise<void>;
};

export function prepareConfirmedDelivery(record: DeliveryRecord, adminId: number, deliveredAt = new Date()) {
  const delivery = validateDelivery(record.request.status, record.part.quantity, record.request.requestedQuantity);
  if (!delivery.ok) return delivery;

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
      details: `Physically handed over ${record.request.requestedQuantity} unit(s) to ${record.engineer.name || "the requesting engineer"}.`,
    } satisfies DeliveryTransaction,
  };
}

/** Executes the delivery write sequence inside the database transaction supplied by the caller. */
export async function executeConfirmedDelivery(record: DeliveryRecord, adminId: number, persistence: DeliveryPersistence, deliveredAt = new Date()) {
  const plan = prepareConfirmedDelivery(record, adminId, deliveredAt);
  if (!plan.ok) return plan;

  await persistence.updatePartQuantity(record.part.id, plan.quantityAfter);
  await persistence.markRequestDelivered(record.request.id, adminId, plan.deliveredAt);
  await persistence.insertTransaction(plan.transaction);
  if (plan.shouldCreateLowStockAlert && !(await persistence.hasUnreadLowStockAlert(record.part.id))) {
    await persistence.createLowStockAlert({
      type: "low_stock",
      title: "Low stock warning",
      body: `${record.part.name} is below its minimum stock threshold after delivery.`,
      partId: record.part.id,
      requestId: record.request.id,
    });
  }
  return plan;
}
