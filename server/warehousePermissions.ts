export type WarehouseRole = "admin" | "engineer" | "viewer" | "storekeeper" | "maintenance_technician" | "purchasing_officer";
export type WarehousePermission = "view_inventory" | "request_stock" | "manage_inventory" | "manage_counts" | "approve_counts" | "manage_traceability" | "manage_work_orders" | "manage_disassembly" | "manage_maintenance" | "manage_purchasing" | "view_reports" | "manage_reports";

const policy: Record<WarehouseRole, WarehousePermission[]> = {
  admin: ["view_inventory", "request_stock", "manage_inventory", "manage_counts", "approve_counts", "manage_traceability", "manage_work_orders", "manage_disassembly", "manage_maintenance", "manage_purchasing", "view_reports", "manage_reports"],
  storekeeper: ["view_inventory", "manage_inventory", "manage_counts", "manage_traceability", "view_reports"],
  maintenance_technician: ["view_inventory", "manage_traceability", "manage_work_orders", "manage_disassembly", "manage_maintenance", "view_reports"],
  purchasing_officer: ["view_inventory", "manage_purchasing", "view_reports"],
  engineer: ["view_inventory", "request_stock"],
  viewer: ["view_inventory", "view_reports"],
};

export function effectiveWarehouseRole(input: { appRole: "admin" | "user"; warehouseRole?: WarehouseRole | null }): WarehouseRole {
  return input.appRole === "admin" ? "admin" : input.warehouseRole ?? "engineer";
}

export function hasWarehousePermission(role: WarehouseRole, permission: WarehousePermission) {
  return policy[role].includes(permission);
}

export function permissionLabel(permission: WarehousePermission) {
  return ({ view_inventory: "عرض المخزون", request_stock: "طلب صرف", manage_inventory: "إدارة المخزون", manage_counts: "تنفيذ الجرد", approve_counts: "اعتماد فروقات الجرد", manage_traceability: "إدارة التتبع", manage_work_orders: "إدارة أوامر العمل", manage_disassembly: "إدارة التشليح", manage_maintenance: "إدارة الصيانة", manage_purchasing: "إدارة المشتريات", view_reports: "عرض التقارير", manage_reports: "إدارة التقارير" } satisfies Record<WarehousePermission, string>)[permission];
}
