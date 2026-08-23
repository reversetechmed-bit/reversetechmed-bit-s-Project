export type DashboardOpenWorkOrder = { order: { departmentId: number | null; priority: string }; department: { id: number; name: string } | null };

export function filterDashboardOpenWorkOrders(rows: DashboardOpenWorkOrder[], filters: { department: string; priority: string }) {
  return rows.filter(row => (filters.department === "all" || (filters.department === "unassigned" ? !row.order.departmentId : String(row.order.departmentId) === filters.department)) && (filters.priority === "all" || row.order.priority === filters.priority));
}
