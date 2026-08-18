import { describe, expect, it } from "vitest";
import { buildReportRows, type ReportColumn } from "../client/src/lib/reportExport";

describe("report export dataset", () => {
  it("turns the selected report rows into printable table values without losing zero quantities", () => {
    type InventoryRow = { code: string; quantity: number; location: string | null };
    const columns: ReportColumn<InventoryRow>[] = [{ label: "Code", value: row => row.code }, { label: "Quantity", value: row => row.quantity }, { label: "Location", value: row => row.location }];
    expect(buildReportRows(columns, [{ code: "3DP-ABS-BLK", quantity: 0, location: null }])).toEqual([["3DP-ABS-BLK", "0", "—"]]);
  });
});
