import { describe, expect, it } from "vitest";
import { filterInventoryCountReportRows } from "../client/src/lib/inventoryCountExport";

const session = (countNumber: string, createdAt: string, varianceLines = 0) => ({ session: { countNumber, warehouseSection: "all" as const, status: "approved", createdAt }, totalLines: 10, countedLines: 10, varianceLines });

describe("inventory count report export", () => {
  it("keeps only the latest daily sessions in a daily report", () => {
    const rows = filterInventoryCountReportRows([session("RT-CNT-1", "2026-08-23T07:00:00.000Z", 2), session("RT-CNT-2", "2026-08-21T08:00:00.000Z")], "daily", new Date("2026-08-23T12:00:00.000Z"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ countNumber: "RT-CNT-1", varianceLines: 2, status: "معتمد" });
  });
  it("keeps the last seven calendar days for the weekly report", () => {
    const rows = filterInventoryCountReportRows([session("RT-CNT-1", "2026-08-17T00:00:00.000Z"), session("RT-CNT-2", "2026-08-16T23:59:00.000Z")], "weekly", new Date("2026-08-23T12:00:00.000Z"));
    expect(rows.map(row => row.countNumber)).toEqual(["RT-CNT-1"]);
  });
});
