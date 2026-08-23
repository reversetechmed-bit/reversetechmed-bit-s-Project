import { describe, expect, it } from "vitest";
import { effectiveWarehouseRole, hasWarehousePermission } from "./warehousePermissions";

describe("granular warehouse permission matrix", () => {
  it("keeps application admins fully authorized regardless of their employee profile", () => {
    expect(effectiveWarehouseRole({ appRole: "admin", warehouseRole: "viewer" })).toBe("admin");
    expect(hasWarehousePermission("admin", "manage_reports")).toBe(true);
  });

  it("separates count execution from count approval and keeps view-only users read-only", () => {
    expect(hasWarehousePermission("storekeeper", "manage_counts")).toBe(true);
    expect(hasWarehousePermission("storekeeper", "approve_counts")).toBe(false);
    expect(hasWarehousePermission("viewer", "view_inventory")).toBe(true);
    expect(hasWarehousePermission("viewer", "request_stock")).toBe(false);
  });

  it("scopes maintenance and purchasing workflows to the specialized roles", () => {
    expect(hasWarehousePermission("maintenance_technician", "manage_disassembly")).toBe(true);
    expect(hasWarehousePermission("maintenance_technician", "manage_purchasing")).toBe(false);
    expect(hasWarehousePermission("purchasing_officer", "manage_purchasing")).toBe(true);
    expect(hasWarehousePermission("purchasing_officer", "manage_work_orders")).toBe(false);
  });
});
