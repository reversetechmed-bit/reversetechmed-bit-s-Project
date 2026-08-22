import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildWarehouseJsonBackup } from "./warehouseBackup";

const source = (relativePath: string) => readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf8");
const sourceData = (overrides: Record<string, unknown> = {}) => ({
  departments: [{ id: 1, name: "الهندسة" }],
  employeeProfiles: [{ id: 1, fullName: "Eng Hamada Mohamed", email: "hamada@example.com", initialPasswordHash: "never-export-this" }],
  users: [{ id: 1, name: "Eng Hamada Mohamed", openId: "supabase-subject", loginMethod: "supabase", role: "user" }],
  inventoryCategories: [{ id: 1, name: "إلكترونيات" }], componentTypes: [{ id: 1, name: "مقاومة" }], companies: [{ id: 1, name: "شركة تجريبية" }],
  parts: [{ id: 1, partNumber: "RT-001" }], productComponents: [{ id: 1, productId: 1, componentId: 1 }], dispensingRequests: [{ id: 1, partId: 1 }], handoverInvoices: [{ id: 1, requestId: 1 }],
  maintenanceCases: [{ id: 1, caseNumber: "MNT-1" }], purchaseOrders: [{ id: 1, orderNumber: "PO-1" }], purchaseOrderLines: [{ id: 1, purchaseOrderId: 1 }], assemblyOrders: [{ id: 1, assemblyNumber: "ASM-1" }], assemblyOrderLines: [{ id: 1, assemblyOrderId: 1 }],
  inventoryTransactions: [{ id: 1, partId: 1 }], warehouseAlerts: [{ id: 1, type: "low_stock" }], warehouseActivities: [{ id: 1, type: "inventory_created" }], warehouseAutomationSettings: [{ id: 1, settingKey: "warehouse-escalations" }],
  ...overrides,
});

describe("warehouse JSON backup", () => {
  it("includes the operational data groups and record counts needed for a controlled restore", () => {
    const backup = buildWarehouseJsonBackup(sourceData());
    expect(backup).toMatchObject({ format: "reverse-tech-warehouse-backup", schemaVersion: 1 });
    expect(backup.recordCounts).toMatchObject({ departments: 1, employees: 1, parts: 1, handoverInvoices: 1, purchaseOrders: 1, assemblyOrders: 1, warehouseActivities: 1 });
    expect(backup.data.parts[0]).toMatchObject({ partNumber: "RT-001" });
    expect(backup.restoreNotes).toContain("لا يحتوي كلمات مرور");
  });

  it("excludes password hashes and external identity identifiers from the downloaded JSON", () => {
    const backup = buildWarehouseJsonBackup(sourceData());
    const json = JSON.stringify(backup);
    expect(backup.data.employees[0]).not.toHaveProperty("initialPasswordHash");
    expect(backup.data.users[0]).not.toHaveProperty("openId");
    expect(backup.data.users[0]).not.toHaveProperty("loginMethod");
    expect(json).not.toContain("never-export-this");
    expect(json).not.toContain("supabase-subject");
  });

  it("keeps export restricted to Admin procedures and exposes an explicit download action", () => {
    const router = source("server/routers/organization.ts");
    const home = source("client/src/pages/Home.tsx");
    expect(router).toContain("exportJson: adminProcedure");
    expect(home).toContain("organization.backup.exportJson.useQuery");
    expect(home).toContain("نسخة احتياطية JSON");
    expect(home).toContain("application/json;charset=utf-8");
  });
});
