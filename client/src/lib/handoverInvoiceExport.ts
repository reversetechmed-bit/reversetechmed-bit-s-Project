import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { fontAsBase64, registerArabicFont, shapePdfText } from "./reportExport";

const ARABIC_FONT = "/manus-storage/NotoNaskhArabic-Regular_7e0fb902.ttf";

type InvoiceRecord = { invoice: any; receiver: { name: string | null; email: string | null } };

function printable(value: string | null | undefined) { return value?.trim() || "—"; }
function dateParts(value: Date | string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("ar-EG", { day: "2-digit", month: "long", year: "numeric" }),
    time: date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
  };
}
function sectionLabel(section: "components" | "products") { return section === "products" ? "المنتجات" : "المكونات"; }
function download(blob: Blob, fileName: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }

export function buildHandoverInvoiceWorkbook(record: InvoiceRecord) {
  const { invoice, receiver } = record; const issued = dateParts(invoice.issuedAt);
  const rows = [
    ["REVERSE TECH"],
    ["فاتورة تسليم من المخزن"],
    ["رقم الفاتورة", invoice.invoiceNumber],
    ["تاريخ التسليم", issued.date],
    ["وقت التسليم", issued.time],
    [],
    ["بيانات الطلب والاستلام"],
    ["مقدم الطلب", printable(invoice.requesterNameSnapshot)],
    ["الشخص المستلم", printable(invoice.recipientNameSnapshot || receiver.name || receiver.email)],
    ["القسم أو الجهة", printable(invoice.recipientDepartmentSnapshot)],
    ["مرجع المشروع أو الجهاز", printable(invoice.projectReferenceSnapshot)],
    [],
    ["بيانات الصنف"],
    ["كود الصنف", invoice.partNumberSnapshot],
    ["اسم الصنف", invoice.partNameSnapshot],
    ["قسم المخزن", sectionLabel(invoice.warehouseSectionSnapshot)],
    ["الكمية المسلّمة", `${invoice.quantity} وحدة`],
    ["غرض الطلب", invoice.purposeSnapshot],
    ["ملاحظة مقدم الطلب", printable(invoice.requestNoteSnapshot)],
    ["ملاحظة التسليم", printable(invoice.deliveryNote)],
    [],
    ["التأكيد الرقمي", invoice.receiptConfirmedAt ? `تم التأكيد باسم ${printable(invoice.receiptConfirmationName)} في ${dateParts(invoice.receiptConfirmedAt).date} ${dateParts(invoice.receiptConfirmedAt).time}` : "بانتظار التأكيد الرقمي من المستلم"],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 26 }, { wch: 58 }];
  worksheet["!rows"] = rows.map((_, index) => ({ hpt: index === 0 ? 30 : index === 1 ? 24 : index === 6 || index === 12 ? 22 : 19 }));
  worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } }, { s: { r: 12, c: 0 }, e: { r: 12, c: 1 } }];
  const navy = "17374C", bronze = "B58A4A", cream = "F4F0E8", border = "D9D0BF";
  const style = (address: string, fill: string, color: string, bold = false, size = 11) => { const cell = worksheet[address] as XLSX.CellObject & { s?: unknown }; if (cell) cell.s = { font: { name: "Arial", sz: size, bold, color: { rgb: color } }, fill: { fgColor: { rgb: fill } }, alignment: { horizontal: "right", vertical: "center", readingOrder: 2, wrapText: true }, border: { bottom: { style: "thin", color: { rgb: border } } } }; };
  style("A1", navy, "FFFFFF", true, 18); style("A2", cream, navy, true, 15); style("A7", bronze, "FFFFFF", true, 12); style("A13", bronze, "FFFFFF", true, 12);
  rows.forEach((_, index) => { if (![0, 1, 5, 6, 11, 12, 20].includes(index)) { style(`A${index + 1}`, cream, navy, true); style(`B${index + 1}`, "FFFFFF", navy); } });
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "فاتورة تسليم"); return workbook;
}

export async function exportHandoverInvoiceExcel(record: InvoiceRecord) {
  const bytes = XLSX.write(buildHandoverInvoiceWorkbook(record), { type: "array", bookType: "xlsx", compression: true });
  download(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${record.invoice.invoiceNumber}.xlsx`);
}

export function buildHandoverInvoicePdfDocument(record: InvoiceRecord, fontBase64: string) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", putOnlyUsedFonts: true });
  registerArabicFont(pdf, fontBase64);
  const { invoice, receiver } = record; const issued = dateParts(invoice.issuedAt); const pageWidth = pdf.internal.pageSize.getWidth(); const right = pageWidth - 42;
  pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), "F");
  pdf.setTextColor(23, 55, 76); pdf.setFont("NotoNaskh", "normal"); pdf.setFontSize(20); pdf.text(shapePdfText(pdf, "إيصال تسليم من المخزن"), pageWidth / 2, 58, { align: "center" });
  pdf.setDrawColor(1, 120, 212); pdf.setLineWidth(1.1); pdf.line(42, 74, right, 74);
  pdf.setFontSize(10.5); pdf.setTextColor(90, 100, 112); pdf.text(shapePdfText(pdf, `تاريخ التسليم: ${issued.date} · ${issued.time}`), pageWidth / 2, 96, { align: "center" });
  const partyRows = [["مقدم الطلب", printable(invoice.requesterNameSnapshot)], ["المستلم", printable(invoice.recipientNameSnapshot || receiver.name || receiver.email)]];
  autoTable(pdf, { startY: 116, body: partyRows.map(row => row.map(value => shapePdfText(pdf, value))), theme: "grid", styles: { font: "NotoNaskh", fontStyle: "normal", fontSize: 10.5, cellPadding: 7, halign: "right", textColor: [23, 55, 76], lineColor: [220, 234, 247], lineWidth: 0.45, overflow: "linebreak" }, columnStyles: { 0: { cellWidth: 130, fillColor: [241, 248, 254] }, 1: { cellWidth: 380 } }, margin: { left: 42, right: 42 } });
  const tableY = (pdf as any).lastAutoTable.finalY + 18;
  autoTable(pdf, { startY: tableY, head: [["اسم الصنف", "كود الصنف", "الكمية"]].map(row => row.map(value => shapePdfText(pdf, value))), body: [[invoice.partNameSnapshot, invoice.partNumberSnapshot, `${invoice.quantity} وحدة`]].map(row => row.map(value => shapePdfText(pdf, value))), theme: "grid", styles: { font: "NotoNaskh", fontStyle: "normal", fontSize: 10.5, cellPadding: 8, halign: "right", textColor: [23, 55, 76], lineColor: [220, 234, 247], lineWidth: 0.45, overflow: "linebreak" }, headStyles: { font: "NotoNaskh", fontStyle: "normal", fillColor: [11, 46, 78], textColor: [255, 255, 255] }, alternateRowStyles: { fillColor: [247, 251, 255] }, margin: { left: 42, right: 42 }, didParseCell: data => { const raw = typeof data.cell.raw === "string" ? data.cell.raw : ""; if (/^[A-Za-z0-9._/-]+$/.test(raw)) { data.cell.styles.font = "helvetica"; data.cell.styles.fontStyle = "normal"; data.cell.styles.halign = "left"; } } });
  const purposeY = (pdf as any).lastAutoTable.finalY + 20;
  autoTable(pdf, { startY: purposeY, body: [[shapePdfText(pdf, "غرض الصرف"), shapePdfText(pdf, printable(invoice.purposeSnapshot))]], theme: "grid", styles: { font: "NotoNaskh", fontStyle: "normal", fontSize: 10, cellPadding: 7, halign: "right", textColor: [23, 55, 76], lineColor: [220, 234, 247], lineWidth: 0.45, overflow: "linebreak" }, columnStyles: { 0: { cellWidth: 130, fillColor: [241, 248, 254] }, 1: { cellWidth: 380 } }, margin: { left: 42, right: 42 } });
  return pdf;
}

export async function exportHandoverInvoicePdf(record: InvoiceRecord) {
  const pdf = buildHandoverInvoicePdfDocument(record, await fontAsBase64(ARABIC_FONT));
  const issuedDate = new Date(record.invoice.issuedAt).toISOString().slice(0, 10);
  pdf.save(`reverse-tech-handover-${record.invoice.partNumberSnapshot}-${issuedDate}.pdf`);
}
