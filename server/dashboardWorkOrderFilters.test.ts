import { describe, expect, it } from "vitest";
import { filterDashboardOpenWorkOrders } from "../client/src/lib/dashboardWorkOrderFilters";

const rows = [
  { order: { departmentId: 1, priority: "urgent" }, department: { id: 1, name: "الصيانة" } },
  { order: { departmentId: 2, priority: "normal" }, department: { id: 2, name: "الإنتاج" } },
  { order: { departmentId: null, priority: "high" }, department: null },
];

describe("dashboard work-order filters", () => {
  it("filters open work orders by department and priority together", () => {
    expect(filterDashboardOpenWorkOrders(rows, { department: "1", priority: "urgent" })).toEqual([rows[0]]);
    expect(filterDashboardOpenWorkOrders(rows, { department: "unassigned", priority: "all" })).toEqual([rows[2]]);
    expect(filterDashboardOpenWorkOrders(rows, { department: "all", priority: "normal" })).toEqual([rows[1]]);
  });
});
