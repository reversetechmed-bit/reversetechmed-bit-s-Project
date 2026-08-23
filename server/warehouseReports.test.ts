import { describe, expect, it } from "vitest";
import { calculateNextReportRun } from "./warehouseReports";

describe("report schedule calculation", () => {
  it("moves a daily report forward when today's run time has passed", () => {
    expect(calculateNextReportRun({ frequency: "daily", runHourUtc: 6, now: new Date("2026-08-23T07:00:00.000Z") }).toISOString()).toBe("2026-08-24T06:00:00.000Z");
  });
  it("schedules a weekly report only on the selected UTC weekday", () => {
    expect(calculateNextReportRun({ frequency: "weekly", weekday: 1, runHourUtc: 9, now: new Date("2026-08-23T08:00:00.000Z") }).toISOString()).toBe("2026-08-24T09:00:00.000Z");
  });
});
