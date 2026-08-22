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
    expect(await count("SELECT COUNT(*) AS total FROM companies WHERE code IN ('DEMO-MEDTECH', 'DEMO-CONTROL') AND isActive = 1")).toBe(2);
    expect(await count("SELECT COUNT(*) AS total FROM parts WHERE partNumber IN ('DEMO-PCB-001', 'DEMO-PROD-001') AND companyId IS NOT NULL AND productStage IN ('work_in_progress', 'finished')")).toBe(2);
    expect(await count("SELECT COUNT(*) AS total FROM productComponents pc JOIN parts product ON product.id = pc.productId JOIN parts component ON component.id = pc.componentId WHERE product.partNumber IN ('DEMO-PCB-001', 'DEMO-PROD-001') AND component.warehouseSection = 'components'")).toBeGreaterThanOrEqual(4);
  });

  it("keeps the requested engineering and administrator roster as active profiles without demo passwords", async () => {
    expect(await count("SELECT COUNT(*) AS total FROM employeeProfiles WHERE employeeCode IN ('RT-ENG-HAMADA', 'RT-ENG-MOSTAFA', 'RT-ENG-MOHAMED-ALI', 'RT-TECH-ABDELMONEM', 'RT-ADMIN-ABDELALIEEM', 'RT-ADMIN-IBRAHIM') AND isActive = 1")).toBe(6);
    expect(await count("SELECT COUNT(*) AS total FROM employeeProfiles WHERE employeeCode LIKE 'RT-%' AND email IS NULL")).toBe(6);
  });
});
