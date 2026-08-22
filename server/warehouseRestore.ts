import { eq } from "drizzle-orm";
import { companies, componentTypes, departments, employeeProfiles, inventoryCategories, parts, productComponents } from "../drizzle/schema";
import type { BackupData } from "./warehouseBackup";

const text = (row: Record<string, unknown>, key: string) => typeof row[key] === "string" ? row[key].trim() : "";
const optionalText = (row: Record<string, unknown>, key: string) => text(row, key) || null;
const numeric = (row: Record<string, unknown>, key: string) => typeof row[key] === "number" && Number.isInteger(row[key]) ? row[key] as number : null;
const flag = (row: Record<string, unknown>, key: string, fallback = 1) => row[key] === 0 || row[key] === 1 ? row[key] as 0 | 1 : fallback;
const stage = (row: Record<string, unknown>) => ["work_in_progress", "under_review", "under_maintenance", "finished", "final_operational"].includes(text(row, "productStage")) ? text(row, "productStage") as "work_in_progress" | "under_review" | "under_maintenance" | "finished" | "final_operational" : null;
const section = (row: Record<string, unknown>) => text(row, "warehouseSection") === "products" ? "products" as const : "components" as const;
const role = (row: Record<string, unknown>) => ["admin", "engineer", "viewer"].includes(text(row, "warehouseRole")) ? text(row, "warehouseRole") as "admin" | "engineer" | "viewer" : "engineer" as const;
const safeDate = (row: Record<string, unknown>, key: string) => { const value = row[key]; if (typeof value !== "string") return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };

type RestoreCounts = { departments: number; employees: number; inventoryCategories: number; componentTypes: number; companies: number; parts: number; productComponents: number };

export async function restoreWarehouseMasterData(tx: any, data: BackupData): Promise<RestoreCounts> {
  const counts: RestoreCounts = { departments: 0, employees: 0, inventoryCategories: 0, componentTypes: 0, companies: 0, parts: 0, productComponents: 0 };
  const sourceDepartmentCode = new Map<number, string>();
  for (const row of data.departments) {
    const name = text(row, "name"), code = text(row, "code"); if (!name || !code) continue;
    const values = { name, code, description: optionalText(row, "description"), isActive: flag(row, "isActive") };
    await tx.insert(departments).values(values).onDuplicateKeyUpdate({ set: values });
    const sourceId = numeric(row, "id"); if (sourceId) sourceDepartmentCode.set(sourceId, code); counts.departments += 1;
  }
  const dbDepartments = await tx.select().from(departments);
  const departmentIdByCode = new Map(dbDepartments.map((item: any) => [item.code, item.id]));

  for (const row of data.inventoryCategories) {
    const name = text(row, "name"); if (!name) continue;
    const values = { name, description: optionalText(row, "description"), colorKey: text(row, "colorKey") || "blue", isActive: flag(row, "isActive") };
    await tx.insert(inventoryCategories).values(values).onDuplicateKeyUpdate({ set: values }); counts.inventoryCategories += 1;
  }
  const dbCategories = await tx.select().from(inventoryCategories);
  const categoryIdByName = new Map(dbCategories.map((item: any) => [item.name, item.id]));
  const sourceCategoryName = new Map(data.inventoryCategories.map(row => [numeric(row, "id"), text(row, "name")] as const).filter(([id, name]) => id && name) as [number, string][]);

  for (const row of data.componentTypes) {
    const name = text(row, "name"); if (!name) continue;
    const values = { name, description: optionalText(row, "description"), isActive: flag(row, "isActive") };
    await tx.insert(componentTypes).values(values).onDuplicateKeyUpdate({ set: values }); counts.componentTypes += 1;
  }
  const dbComponentTypes = await tx.select().from(componentTypes);
  const componentTypeIdByName = new Map(dbComponentTypes.map((item: any) => [item.name, item.id]));
  const sourceComponentTypeName = new Map(data.componentTypes.map(row => [numeric(row, "id"), text(row, "name")] as const).filter(([id, name]) => id && name) as [number, string][]);

  for (const row of data.companies) {
    const name = text(row, "name"), code = text(row, "code"); if (!name || !code) continue;
    const values = { name, code, contactName: optionalText(row, "contactName"), contactPhone: optionalText(row, "contactPhone"), contactEmail: optionalText(row, "contactEmail"), notes: optionalText(row, "notes"), isActive: flag(row, "isActive") };
    await tx.insert(companies).values(values).onDuplicateKeyUpdate({ set: values }); counts.companies += 1;
  }
  const dbCompanies = await tx.select().from(companies);
  const companyIdByCode = new Map(dbCompanies.map((item: any) => [item.code, item.id]));
  const sourceCompanyCode = new Map(data.companies.map(row => [numeric(row, "id"), text(row, "code")] as const).filter(([id, code]) => id && code) as [number, string][]);

  const sourcePartNumber = new Map<number, string>();
  for (const row of data.parts) {
    const partNumber = text(row, "partNumber"), name = text(row, "name"), category = text(row, "category"); if (!partNumber || !name || !category) continue;
    const sourceCategoryId = numeric(row, "categoryId"), sourceTypeId = numeric(row, "componentTypeId"), sourceCompanyId = numeric(row, "companyId");
    const categoryId = sourceCategoryId ? categoryIdByName.get(sourceCategoryName.get(sourceCategoryId) ?? "") ?? null : null;
    const componentTypeId = sourceTypeId ? componentTypeIdByName.get(sourceComponentTypeName.get(sourceTypeId) ?? "") ?? null : null;
    const companyId = sourceCompanyId ? companyIdByCode.get(sourceCompanyCode.get(sourceCompanyId) ?? "") ?? null : null;
    const values = { partNumber, name, description: optionalText(row, "description"), category, categoryId, warehouseSection: section(row), componentTypeId, companyId, productStage: stage(row), minimumStock: Math.max(0, numeric(row, "minimumStock") ?? 0), location: optionalText(row, "location"), storageShelf: optionalText(row, "storageShelf"), storageDrawer: optionalText(row, "storageDrawer"), storageBox: optionalText(row, "storageBox"), imageUrl: optionalText(row, "imageUrl"), specifications: optionalText(row, "specifications") };
    await tx.insert(parts).values(values).onDuplicateKeyUpdate({ set: values }); const sourceId = numeric(row, "id"); if (sourceId) sourcePartNumber.set(sourceId, partNumber); counts.parts += 1;
  }
  const dbParts = await tx.select().from(parts);
  const partIdByNumber = new Map<string, number>(dbParts.map((item: any): [string, number] => [item.partNumber, item.id]));

  for (const row of data.employees) {
    const employeeCode = text(row, "employeeCode"), fullName = text(row, "fullName"), jobTitle = text(row, "jobTitle"); if (!employeeCode || !fullName || !jobTitle) continue;
    const sourceDepartmentId = numeric(row, "departmentId"); const departmentId = sourceDepartmentId ? departmentIdByCode.get(sourceDepartmentCode.get(sourceDepartmentId) ?? "") ?? null : null;
    const [existing] = await tx.select({ id: employeeProfiles.id }).from(employeeProfiles).where(eq(employeeProfiles.employeeCode, employeeCode)).limit(1);
    const values = { fullName, email: optionalText(row, "email"), jobTitle, departmentId, warehouseRole: role(row), isActive: flag(row, "isActive"), suspendedUntil: safeDate(row, "suspendedUntil"), accessRevokedAt: safeDate(row, "accessRevokedAt") };
    if (existing) await tx.update(employeeProfiles).set(values).where(eq(employeeProfiles.id, existing.id)); else await tx.insert(employeeProfiles).values({ employeeCode, ...values }); counts.employees += 1;
  }

  const productsToReplace = new Set<number>();
  for (const row of data.productComponents) { const productPartNumber = sourcePartNumber.get(numeric(row, "productId") ?? -1); const productId = productPartNumber ? partIdByNumber.get(productPartNumber) : undefined; if (productId) productsToReplace.add(productId); }
  for (const productId of Array.from(productsToReplace)) await tx.delete(productComponents).where(eq(productComponents.productId, productId));
  for (const row of data.productComponents) {
    const productId = partIdByNumber.get(sourcePartNumber.get(numeric(row, "productId") ?? -1) ?? ""); const componentId = partIdByNumber.get(sourcePartNumber.get(numeric(row, "componentId") ?? -1) ?? ""); const quantityRequired = numeric(row, "quantityRequired") ?? 0;
    if (!productId || !componentId || productId === componentId || quantityRequired < 1) continue;
    await tx.insert(productComponents).values({ productId, componentId, quantityRequired, notes: optionalText(row, "notes") }); counts.productComponents += 1;
  }
  return counts;
}
