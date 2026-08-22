import { describe, expect, it } from "vitest";
import { applyWorksheetRtlView, buildReportRows, buildReportWorkbook, type ReportColumn } from "../client/src/lib/reportExport";
import { buildHandoverInvoiceWorkbook } from "../client/src/lib/handoverInvoiceExport";

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

  it("builds a single-invoice workbook with separately labeled request, recipient, project, and delivery fields", () => {
    const workbook = buildHandoverInvoiceWorkbook({
      invoice: {
        invoiceNumber: "RT-HO-20260822-00001", issuedAt: new Date("2026-08-22T09:30:00.000Z"), requesterNameSnapshot: "مقدم الطلب", recipientNameSnapshot: "المستلم", recipientDepartmentSnapshot: "الهندسة الطبية", projectReferenceSnapshot: "MED-42", partNumberSnapshot: "MD-42", partNameSnapshot: "لوحة تحكم", warehouseSectionSnapshot: "products", quantity: 2, purposeSnapshot: "اختبار", requestNoteSnapshot: "يرجى التعامل بحذر", deliveryNote: "تم التسليم بحالة سليمة", receiptConfirmedAt: null,
      },
      receiver: { name: "المستلم", email: null },
    });
    const worksheet = workbook.Sheets["فاتورة تسليم"];
    expect(worksheet["A1"]?.v).toBe("REVERSE TECH");
    expect(worksheet["A8"]?.v).toBe("مقدم الطلب");
    expect(worksheet["B9"]?.v).toBe("المستلم");
    expect(worksheet["B11"]?.v).toBe("MED-42");
    expect(worksheet["B20"]?.v).toBe("تم التسليم بحالة سليمة");
  });
});
