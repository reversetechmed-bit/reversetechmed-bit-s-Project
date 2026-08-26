import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "routers/warehouse.ts"), "utf8");

describe("safe inventory part removal", () => {
  it("checks operational references before deleting a part", () => {
    for (const table of [
      "dispensingRequests",
      "custodyAssignments",
      "inventoryTransactions",
      "inventoryCountLines",
      "serialAssets",
      "productComponents",
      "workOrders",
      "workOrderLines",
      "disassemblyOrders",
      "disassemblyLines",
      "purchaseOrderLines",
      "assemblyOrderLines",
      "maintenanceCases",
    ]) {
      expect(source).toContain(table);
    }
    expect(source).toContain("استخدم الأرشفة للحفاظ على سجل التدقيق.");
  });

  it("maps database constraint failures to an actionable Arabic conflict", () => {
    expect(source).toContain("لا يمكن حذف الصنف لوجود سجل مرتبط به. استخدم الأرشفة للحفاظ على سلامة البيانات.");
    expect(source).toContain("foreign key|constraint|cannot delete");
  });
});
