import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type ReportColumn<T extends Record<string, unknown>> = { label: string; value: (row: T) => string | number | null | undefined };

function stamp() { return new Date().toISOString().slice(0, 10); }
function printable(value: string | number | null | undefined) { return value === null || value === undefined ? "—" : String(value); }

export function buildReportRows<T extends Record<string, unknown>>(columns: ReportColumn<T>[], rows: T[]) {
  return rows.map(row => columns.map(column => printable(column.value(row))));
}

export function exportReportExcel<T extends Record<string, unknown>>(title: string, filePrefix: string, columns: ReportColumn<T>[], rows: T[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([["REVERSE TECH"], [title], [`تاريخ الإنشاء: ${new Date().toLocaleString("ar-EG")}`], [], columns.map(column => column.label), ...buildReportRows(columns, rows)]);
  worksheet["!cols"] = columns.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير");
  XLSX.writeFile(workbook, `${filePrefix}-${stamp()}.xlsx`);
}

export function exportReportPdf<T extends Record<string, unknown>>(title: string, filePrefix: string, columns: ReportColumn<T>[], rows: T[]) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  pdf.setTextColor(11, 46, 78); pdf.setFontSize(18); pdf.text("REVERSE TECH", 40, 42);
  pdf.setFontSize(12); pdf.text(title, 40, 64);
  pdf.setTextColor(90, 105, 120); pdf.setFontSize(8); pdf.text(`تاريخ الإنشاء: ${new Date().toLocaleString("ar-EG")}`, 40, 80);
  autoTable(pdf, { startY: 94, head: [columns.map(column => column.label)], body: buildReportRows(columns, rows), styles: { fontSize: 7, cellPadding: 5 }, headStyles: { fillColor: [1, 120, 212], textColor: 255 }, alternateRowStyles: { fillColor: [244, 249, 253] }, margin: { left: 36, right: 36 } });
  pdf.save(`${filePrefix}-${stamp()}.pdf`);
}
