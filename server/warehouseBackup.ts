type BackupSource = {
  departments: any[];
  employeeProfiles: any[];
  users: any[];
  inventoryCategories: any[];
  componentTypes: any[];
  companies: any[];
  parts: any[];
  productComponents: any[];
  dispensingRequests: any[];
  handoverInvoices: any[];
  maintenanceCases: any[];
  purchaseOrders: any[];
  purchaseOrderLines: any[];
  assemblyOrders: any[];
  assemblyOrderLines: any[];
  inventoryTransactions: any[];
  warehouseAlerts: any[];
  warehouseActivities: any[];
  warehouseAutomationSettings: any[];
};

function withoutKeys<T extends Record<string, unknown>>(row: T, keys: string[]) {
  const copy = { ...row } as Record<string, unknown>;
  for (const key of keys) delete copy[key];
  return copy;
}

export function buildWarehouseJsonBackup(source: BackupSource) {
  const data = {
    departments: source.departments,
    employees: source.employeeProfiles.map(row => withoutKeys(row, ["initialPasswordHash"])),
    users: source.users.map(row => withoutKeys(row, ["openId", "loginMethod"])),
    inventoryCategories: source.inventoryCategories,
    componentTypes: source.componentTypes,
    companies: source.companies,
    parts: source.parts,
    productComponents: source.productComponents,
    dispensingRequests: source.dispensingRequests,
    handoverInvoices: source.handoverInvoices,
    maintenanceCases: source.maintenanceCases,
    purchaseOrders: source.purchaseOrders,
    purchaseOrderLines: source.purchaseOrderLines,
    assemblyOrders: source.assemblyOrders,
    assemblyOrderLines: source.assemblyOrderLines,
    inventoryTransactions: source.inventoryTransactions,
    warehouseAlerts: source.warehouseAlerts,
    warehouseActivities: source.warehouseActivities,
    warehouseAutomationSettings: source.warehouseAutomationSettings,
  };
  const recordCounts = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length]));
  return {
    format: "reverse-tech-warehouse-backup",
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    restoreNotes: "الملف لا يحتوي كلمات مرور أو بصمات أو جلسات أو مفاتيح. تُعاد حسابات المصادقة الخارجية وتُراجع روابط المستخدمين يدويًا عند الاستعادة.",
    recordCounts,
    data,
  };
}
