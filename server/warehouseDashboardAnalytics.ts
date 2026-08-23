export type TrendWorkOrder = { id: number; status: string; createdAt: Date; completedAt: Date | null; updatedAt: Date };
export type TrendCountVariance = { varianceQuantity: number | null; countedAt: Date | null; updatedAt: Date; sessionStatus: string };

type TrendPoint = { dateKey: string; label: string; openWorkOrders: number; countVarianceLines: number; countVarianceUnits: number };

function atStartOfDay(value: Date) { const result = new Date(value); result.setHours(0, 0, 0, 0); return result; }
function atEndOfDay(value: Date) { const result = new Date(value); result.setHours(23, 59, 59, 999); return result; }
function dateKey(value: Date) { return value.toISOString().slice(0, 10); }

export function buildMonthlyDashboardTrend(workOrders: TrendWorkOrder[], countVariances: TrendCountVariance[], now = new Date(), days = 30): TrendPoint[] {
  const today = atStartOfDay(now);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today); day.setDate(today.getDate() - (days - index - 1));
    const dayEnd = atEndOfDay(day);
    const key = dateKey(day);
    const label = day.toLocaleDateString("ar-EG", { day: "2-digit", month: "short" });
    const matchingVariances = countVariances.filter(item => {
      const timestamp = item.countedAt ?? item.updatedAt;
      return item.sessionStatus !== "cancelled" && item.varianceQuantity !== null && item.varianceQuantity !== 0 && dateKey(timestamp) === key;
    });
    return {
      dateKey: key,
      label,
      openWorkOrders: workOrders.filter(order => order.createdAt <= dayEnd && !(order.completedAt && order.completedAt <= dayEnd) && !(order.status === "cancelled" && order.updatedAt <= dayEnd)).length,
      countVarianceLines: matchingVariances.length,
      countVarianceUnits: matchingVariances.reduce((sum, item) => sum + Math.abs(item.varianceQuantity ?? 0), 0),
    };
  });
}
