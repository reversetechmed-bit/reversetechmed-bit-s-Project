import { describe, expect, it } from "vitest";
import { buildOperationalEscalations, prepareMaintenanceDispatch, prepareMaintenanceReceipt } from "./warehouseOperations";

const part = { id: 7, partNumber: "RT-PART-7", name: "وحدة اختبار", quantity: 10, reservedQuantity: 2, minimumStock: 3, warehouseSection: "components" as const };

describe("warehouse operational escalations and maintenance", () => {
  it("rejects maintenance dispatch that would consume reserved stock", () => {
    const plan = prepareMaintenanceDispatch({ maintenanceCase: { id: 1, caseNumber: "RT-MNT-1", type: "maintenance_outbound", status: "open", quantity: 9 }, part }, 4);
    expect(plan).toMatchObject({ ok: false });
  });

  it("records a negative maintenance movement on dispatch and a positive movement on inspected return", () => {
    const outgoing = prepareMaintenanceDispatch({ maintenanceCase: { id: 1, caseNumber: "RT-MNT-1", type: "maintenance_outbound", status: "open", quantity: 4 }, part }, 4, new Date("2026-08-22T08:00:00Z"));
    expect(outgoing).toMatchObject({ ok: true, quantityAfter: 6, transaction: { type: "maintenance_dispatched", quantityDelta: -4 } });
    const incoming = prepareMaintenanceReceipt({ maintenanceCase: { id: 2, caseNumber: "RT-RMA-1", type: "customer_return", status: "awaiting_inspection", quantity: 3 }, part }, 4, new Date("2026-08-22T09:00:00Z"));
    expect(incoming).toMatchObject({ ok: true, quantityAfter: 13, transaction: { type: "maintenance_returned", quantityDelta: 3 } });
  });

  it("creates deterministic alerts for low stock, a delayed request, and an unconfirmed receipt", () => {
    const now = new Date("2026-08-22T12:00:00Z");
    const alerts = buildOperationalEscalations({
      now,
      parts: [{ ...part, quantity: 4, reservedQuantity: 1 }],
      requests: [{ id: 11, status: "approved", partId: 7, createdAt: new Date("2026-08-20T10:00:00Z") }],
      invoices: [{ id: 12, invoiceNumber: "RT-HO-12", partId: 7, requestId: 11, issuedAt: new Date("2026-08-21T10:00:00Z"), receiptConfirmedAt: null }],
    });
    expect(alerts.map(alert => alert.type)).toEqual(["low_stock", "overdue_request", "receipt_confirmation_pending"]);
    expect(alerts.map(alert => alert.dedupeKey)).toEqual(["low-stock:7:2026-08-22", "overdue-request:11", "receipt-pending:12"]);
  });
});
