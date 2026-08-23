import { describe, expect, it } from "vitest";
import { buildMonthlyDashboardTrend } from "./warehouseDashboardAnalytics";

describe("monthly dashboard trends", () => {
  it("builds daily open-work-order and count-variance series across the requested window", () => {
    const trend = buildMonthlyDashboardTrend(
      [
        { id: 1, status: "in_progress", createdAt: new Date("2026-08-21T10:00:00Z"), completedAt: null, updatedAt: new Date("2026-08-21T10:00:00Z") },
        { id: 2, status: "completed", createdAt: new Date("2026-08-22T10:00:00Z"), completedAt: new Date("2026-08-23T09:00:00Z"), updatedAt: new Date("2026-08-23T09:00:00Z") },
      ],
      [
        { varianceQuantity: -3, countedAt: new Date("2026-08-22T12:00:00Z"), updatedAt: new Date("2026-08-22T12:00:00Z"), sessionStatus: "approved" },
        { varianceQuantity: 2, countedAt: new Date("2026-08-23T12:00:00Z"), updatedAt: new Date("2026-08-23T12:00:00Z"), sessionStatus: "submitted" },
        { varianceQuantity: 5, countedAt: new Date("2026-08-23T12:00:00Z"), updatedAt: new Date("2026-08-23T12:00:00Z"), sessionStatus: "cancelled" },
      ],
      new Date("2026-08-23T13:00:00Z"),
      3,
    );
    expect(trend.map(point => point.dateKey)).toEqual(["2026-08-21", "2026-08-22", "2026-08-23"]);
    expect(trend[0]?.openWorkOrders).toBe(1);
    expect(trend[1]).toMatchObject({ openWorkOrders: 2, countVarianceLines: 1, countVarianceUnits: 3 });
    expect(trend[2]).toMatchObject({ openWorkOrders: 1, countVarianceLines: 1, countVarianceUnits: 2 });
  });
});
