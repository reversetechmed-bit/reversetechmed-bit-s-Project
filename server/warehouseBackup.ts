type BackupSource = {
  departments: Record<string, unknown>[]; employeeProfiles: Record<string, unknown>[]; users: Record<string, unknown>[]; inventoryCategories: Record<string, unknown>[]; componentTypes: Record<string, unknown>[]; companies: Record<string, unknown>[]; parts: Record<string, unknown>[]; productComponents: Record<string, unknown>[]; dispensingRequests: Record<string, unknown>[]; handoverInvoices: Record<string, unknown>[]; maintenanceCases: Record<string, unknown>[]; purchaseOrders: Record<string, unknown>[]; purchaseOrderLines: Record<string, unknown>[]; assemblyOrders: Record<string, unknown>[]; assemblyOrderLines: Record<string, unknown>[]; inventoryTransactions: Record<string, unknown>[]; warehouseAlerts: Record<string, unknown>[]; warehouseActivities: Record<string, unknown>[]; warehouseAutomationSettings: Record<string, unknown>[];
};

export const backupDataKeys = ["departments", "employees", "users", "inventoryCategories", "componentTypes", "companies", "parts", "productComponents", "dispensingRequests", "handoverInvoices", "maintenanceCases", "purchaseOrders", "purchaseOrderLines", "assemblyOrders", "assemblyOrderLines", "inventoryTransactions", "warehouseAlerts", "warehouseActivities", "warehouseAutomationSettings"] as const;
export const masterImportKeys = ["departments", "employees", "inventoryCategories", "componentTypes", "companies", "parts", "productComponents"] as const;
const blockedImportKeys = new Set(["initialpasswordhash", "password", "passwordhash", "passcode", "codehash", "openid", "loginmethod", "accesstoken", "refreshtoken", "session", "jwt", "secret", "apikey", "authorization"]);

export type BackupData = Record<(typeof backupDataKeys)[number], Record<string, unknown>[]>;

function withoutKeys<T extends Record<string, unknown>>(row: T, keys: string[]) {
  const copy = { ...row } as Record<string, unknown>;
  for (const key of keys) delete copy[key];
  return copy;
}

function hasBlockedField(value: unknown, path = "data"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) { const result = hasBlockedField(value[index], `${path}[${index}]`); if (result) return result; }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (blockedImportKeys.has(key.replace(/[^a-z]/gi, "").toLowerCase())) return `${path}.${key}`;
    const result = hasBlockedField(nestedValue, `${path}.${key}`);
    if (result) return result;
  }
  return null;
}

function asRows(value: unknown) { return Array.isArray(value) && value.every(row => row && typeof row === "object" && !Array.isArray(row)) ? value as Record<string, unknown>[] : null; }

export type BackupPreview = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  generatedAt: string | null;
  recordCounts: Record<string, number>;
  supportedImportCounts: Record<string, number>;
  skippedOperationalCounts: Record<string, number>;
  data?: BackupData;
};

export function inspectWarehouseJsonBackup(input: unknown): BackupPreview {
  const errors: string[] = []; const warnings: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { valid: false, errors: ["ملف JSON ليس نسخة مخزن صالحة."], warnings, generatedAt: null, recordCounts: {}, supportedImportCounts: {}, skippedOperationalCounts: {} };
  const root = input as Record<string, unknown>;
  if (root.format !== "reverse-tech-warehouse-backup") errors.push("صيغة الملف غير مدعومة. استخدم ملف JSON الذي نزلته من نظام المخزن.");
  if (root.schemaVersion !== 1) errors.push("إصدار ملف النسخة غير مدعوم.");
  if (!root.data || typeof root.data !== "object" || Array.isArray(root.data)) errors.push("الملف لا يحتوي كتلة بيانات صالحة.");
  const rawData = (root.data ?? {}) as Record<string, unknown>;
  const data = {} as BackupData;
  for (const key of backupDataKeys) {
    const rows = asRows(rawData[key]);
    if (!rows) errors.push(`مجموعة البيانات «${key}» غير صالحة أو مفقودة.`);
    data[key] = rows ?? [];
  }
  const blockedField = hasBlockedField(rawData);
  if (blockedField) errors.push(`الملف يحتوي حقلًا حساسًا غير مسموح باستيراده: ${blockedField}.`);
  const recordCounts = Object.fromEntries(backupDataKeys.map(key => [key, data[key].length]));
  const supportedImportCounts = Object.fromEntries(masterImportKeys.map(key => [key, data[key].length]));
  const skippedOperationalCounts = Object.fromEntries(backupDataKeys.filter(key => !masterImportKeys.includes(key as typeof masterImportKeys[number])).map(key => [key, data[key].length]));
  const operationalTotal = Object.values(skippedOperationalCounts).reduce((total, count) => total + count, 0);
  if (operationalTotal) warnings.push(`سيُعرض ${operationalTotal} سجل تشغيلي للأرشفة فقط؛ لا تُستورد الطلبات أو المعاملات أو الفواتير أو الأرصدة عبر هذا الزر.`);
  warnings.push("سيتم دمج البيانات الأساسية بعد التأكيد؛ راجع الأعداد قبل متابعة الاستيراد.");
  return { valid: errors.length === 0, errors, warnings, generatedAt: typeof root.generatedAt === "string" ? root.generatedAt : null, recordCounts, supportedImportCounts, skippedOperationalCounts, ...(errors.length === 0 ? { data } : {}) };
}

export function buildWarehouseJsonBackup(source: BackupSource) {
  const data: BackupData = {
    departments: source.departments, employees: source.employeeProfiles.map(row => withoutKeys(row, ["initialPasswordHash"])), users: source.users.map(row => withoutKeys(row, ["openId", "loginMethod"])), inventoryCategories: source.inventoryCategories, componentTypes: source.componentTypes, companies: source.companies, parts: source.parts, productComponents: source.productComponents, dispensingRequests: source.dispensingRequests, handoverInvoices: source.handoverInvoices, maintenanceCases: source.maintenanceCases, purchaseOrders: source.purchaseOrders, purchaseOrderLines: source.purchaseOrderLines, assemblyOrders: source.assemblyOrders, assemblyOrderLines: source.assemblyOrderLines, inventoryTransactions: source.inventoryTransactions, warehouseAlerts: source.warehouseAlerts, warehouseActivities: source.warehouseActivities, warehouseAutomationSettings: source.warehouseAutomationSettings,
  };
  const recordCounts = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length]));
  return { format: "reverse-tech-warehouse-backup", schemaVersion: 1, generatedAt: new Date().toISOString(), restoreNotes: "الملف لا يحتوي كلمات مرور أو بصمات أو جلسات أو مفاتيح. تُعاد حسابات المصادقة الخارجية وتُراجع روابط المستخدمين يدويًا عند الاستعادة.", recordCounts, data };
}
