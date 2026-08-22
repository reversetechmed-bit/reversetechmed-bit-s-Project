import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildWarehouseJsonBackup, inspectWarehouseJsonBackup } from "./warehouseBackup";

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
    const workspace = source("client/src/pages/BackupRestore.tsx");
    expect(router).toContain("exportJson: adminProcedure");
    expect(workspace).toContain("organization.backup.exportJson.useQuery");
    expect(workspace).toContain("تنزيل النسخة الاحتياطية JSON");
    expect(workspace).toContain("application/json;charset=utf-8");
  });

  it("accepts its own downloaded format for read-only preview and separates supported from operational records", () => {
    const preview = inspectWarehouseJsonBackup(buildWarehouseJsonBackup(sourceData()));
    expect(preview.valid).toBe(true);
    expect(preview.errors).toEqual([]);
    expect(preview.supportedImportCounts).toMatchObject({ departments: 1, employees: 1, parts: 1, productComponents: 1 });
    expect(preview.skippedOperationalCounts).toMatchObject({ dispensingRequests: 1, handoverInvoices: 1, inventoryTransactions: 1 });
    expect(preview.warnings.join(" ")).toContain("لا تُستورد الطلبات");
  });

  it("rejects uploaded sensitive fields before any restore action", () => {
    const backup = buildWarehouseJsonBackup(sourceData());
    const unsafe = { ...backup, data: { ...backup.data, parts: [{ id: 1, partNumber: "RT-001", password: "do-not-import" }] } };
    const preview = inspectWarehouseJsonBackup(unsafe);
    expect(preview.valid).toBe(false);
    expect(preview.errors.join(" ")).toContain("حقلًا حساسًا");
  });

  it("requires Admin preview and an explicit confirmation gate before merging imported master data", () => {
    const router = source("server/routers/organization.ts");
    const restore = source("server/warehouseRestore.ts");
    const workspace = source("client/src/pages/BackupRestore.tsx");
    expect(router).toContain("previewImport: adminProcedure");
    expect(router).toContain("importMasterData: adminProcedure");
    expect(router).toContain('confirmation: z.literal("MERGE_MASTER_DATA")');
    expect(restore).not.toContain("initialPasswordHash");
    expect(workspace).toContain("MERGE_MASTER_DATA");
    expect(workspace).toContain("لم تُكتب أي بيانات في المخزن حتى الآن");
  });
});
