import { describe, expect, it } from "vitest";
import { applyWorksheetRtlView, buildReportRows, buildReportWorkbook, type ReportColumn } from "../client/src/lib/reportExport";

describe("report export dataset", () => {
  it("turns the selected report rows into printable table values without losing zero quantities", () => {
    type InventoryRow = { code: string; quantity: number; location: string | null };
    const columns: ReportColumn<InventoryRow>[] = [{ label: "Code", value: row => row.code }, { label: "Quantity", value: row => row.quantity }, { label: "Location", value: row => row.location }];
    expect(buildReportRows(columns, [{ code: "3DP-ABS-BLK", quantity: 0, location: null }])).toEqual([["3DP-ABS-BLK", "0", "—"]]);
  });

  it("builds a right-to-left branded worksheet with merged Arabic report headers", () => {
    type InventoryRow = { code: string; quantity: number };
    const columns: ReportColumn<InventoryRow>[] = [{ label: "الكود", value: row => row.code }, { label: "الكمية", value: row => row.quantity }];
    const { worksheet } = buildReportWorkbook("تقرير مخزون المكونات", columns, [{ code: "REV-01", quantity: 12 }]);

    expect(worksheet["A1"]?.v).toContain("REVERSE TECH");
    expect(worksheet["A6"]?.v).toBe("الكود");
    expect(worksheet["B7"]?.v).toBe("12");
    expect(worksheet["!merges"]).toHaveLength(4);
  });

  it("sets an explicit RTL sheet view and frozen report header in the exported workbook XML", () => {
    const xml = applyWorksheetRtlView('<worksheet><sheetViews><sheetView workbookViewId="0"/></sheetViews></worksheet>');
    expect(xml).toContain('rightToLeft="1"');
    expect(xml).toContain('showGridLines="0"');
    expect(xml).toContain('ySplit="6"');
  });
});
