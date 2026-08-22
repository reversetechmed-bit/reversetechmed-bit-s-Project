import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type CountRow = Record<string, number>;

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("demo warehouse workflow integration", () => {
  let connection: mysql.Connection;

  beforeAll(async () => {
    connection = await mysql.createConnection(databaseUrl!);
  });

  afterAll(async () => {
    await connection?.end();
  });

  const count = async (sql: string, values: unknown[] = []) => {
    const [rows] = await connection.execute<CountRow[]>(sql, values);
    return Number(rows[0]?.total ?? 0);
  };

  it("exposes an end-to-end request, reservation, delivery, invoice, receipt, and alert path", async () => {
    expect(await count("SELECT COUNT(*) AS total FROM dispensingRequests WHERE purpose LIKE '%[بيانات تجريبية]%' AND status = 'pending'")).toBeGreaterThanOrEqual(1);
    expect(await count("SELECT COUNT(*) AS total FROM dispensingRequests WHERE purpose LIKE '%[بيانات تجريبية]%' AND status = 'approved'")).toBeGreaterThanOrEqual(1);
    expect(await count("SELECT COUNT(*) AS total FROM dispensingRequests WHERE purpose LIKE '%[بيانات تجريبية]%' AND status = 'delivered'")).toBeGreaterThanOrEqual(1);
    expect(await count("SELECT COUNT(*) AS total FROM parts WHERE partNumber = 'DEMO-EMB-001' AND reservedQuantity >= 5")).toBe(1);
    expect(await count("SELECT COUNT(*) AS total FROM handoverInvoices WHERE invoiceNumber = 'DEMO-INV-0001' AND recipientNameSnapshot IS NOT NULL AND projectReferenceSnapshot IS NOT NULL AND deliveryNote IS NOT NULL AND receiptConfirmedAt IS NOT NULL")).toBe(1);
    expect(await count("SELECT COUNT(*) AS total FROM warehouseAlerts WHERE title LIKE '%[بيانات تجريبية]%' AND type IN ('new_request', 'request_approved', 'handover_completed', 'low_stock')")).toBeGreaterThanOrEqual(4);
  });

  it("models companies, finished and work-in-progress products, and component lists without duplicate stock", async () => {
    expect(await count("SELECT COUNT(*) AS total FROM companies WHERE code IN ('DEMO-MEDTECH', 'DEMO-CONTROL', 'DEMO-SUPPLY') AND isActive = 1")).toBe(3);
    expect(await count("SELECT COUNT(*) AS total FROM parts WHERE partNumber IN ('DEMO-PCB-001', 'DEMO-PROD-001') AND companyId IS NOT NULL AND productStage IN ('work_in_progress', 'finished')")).toBe(2);
    expect(await count("SELECT COUNT(*) AS total FROM productComponents pc JOIN parts product ON product.id = pc.productId JOIN parts component ON component.id = pc.componentId WHERE product.partNumber IN ('DEMO-PCB-001', 'DEMO-PROD-001') AND component.warehouseSection = 'components'")).toBeGreaterThanOrEqual(4);
    expect(await count("SELECT COUNT(*) AS total FROM productComponents pc JOIN parts product ON product.id = pc.productId JOIN parts source ON source.id = pc.componentId WHERE product.partNumber = 'DEMO-PROD-001' AND source.productStage = 'work_in_progress'")).toBe(1);
  });

  it("exposes maintenance, customer-return, purchasing, assembly, and escalation examples", async () => {
    expect(await count("SELECT COUNT(*) AS total FROM maintenanceCases WHERE caseNumber IN ('DEMO-MNT-0001', 'DEMO-MNT-0002') AND type IN ('maintenance_outbound', 'customer_return')")).toBe(2);
    expect(await count("SELECT COUNT(*) AS total FROM purchaseOrders po JOIN purchaseOrderLines pol ON pol.purchaseOrderId = po.id WHERE po.orderNumber = 'DEMO-PO-0001' AND po.status = 'partially_received' AND pol.quantityReceived = 5")).toBe(1);
    expect(await count("SELECT COUNT(*) AS total FROM assemblyOrders ao JOIN assemblyOrderLines aol ON aol.assemblyOrderId = ao.id WHERE ao.assemblyNumber = 'DEMO-ASM-0001' AND ao.status = 'completed' AND aol.quantityConsumed = 1")).toBeGreaterThanOrEqual(3);
    expect(await count("SELECT COUNT(*) AS total FROM warehouseAlerts WHERE type IN ('overdue_request', 'receipt_confirmation_pending') AND dedupeKey IS NOT NULL")).toBeGreaterThanOrEqual(2);
  });

  it("keeps the requested engineering and administrator roster as active profiles with an optional Admin-issued access state", async () => {
    expect(await count("SELECT COUNT(*) AS total FROM employeeProfiles WHERE fullName IN ('Eng Hamada Mohamed', 'Eng Mostafa Mabrouk', 'Eng Mohamed Ali', 'Sh. Abdelmon''em Eldesouky', 'Eng Abdelalieem Ahmed', 'Eng Ibrahim Eldesouky') AND isActive = 1")).toBe(6);
    expect(await count("SELECT COUNT(*) AS total FROM employeeProfiles WHERE employeeCode LIKE 'RT-%' AND initialPasswordHash IS NOT NULL AND initialPasswordIssuedAt IS NULL")).toBe(0);
  });
});
