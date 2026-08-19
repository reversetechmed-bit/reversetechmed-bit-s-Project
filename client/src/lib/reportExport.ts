import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import * as XLSX from "xlsx-js-style";

export type ReportColumn<T extends Record<string, unknown>> = {
  label: string;
  value: (row: T) => string | number | null | undefined;
};

const BRAND = {
  navy: "0B2E4E",
  blue: "0178D4",
  paleBlue: "F1F8FE",
  border: "DCEAF7",
  text: "28445F",
  muted: "6B7F90",
  white: "FFFFFF",
} as const;

const NOTO_NASKH_ARABIC = "/manus-storage/NotoNaskhArabic-Regular_7e0fb902.ttf";

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function printable(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function arabicDate() {
  return new Date().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

function arabicDateParts() {
  const now = new Date();
  return {
    date: now.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }),
    time: now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
  };
}

function setStyle(worksheet: XLSX.WorkSheet, address: string, style: Record<string, unknown>) {
  const cell = worksheet[address] as (XLSX.CellObject & { s?: Record<string, unknown> }) | undefined;
  if (cell) cell.s = style;
}

function columnWidth(label: string, values: string[]) {
  const longest = Math.max(label.length, ...values.map(value => value.length));
  return { wch: Math.min(Math.max(longest + 4, 14), 34) };
}

export function buildReportRows<T extends Record<string, unknown>>(columns: ReportColumn<T>[], rows: T[]) {
  return rows.map(row => columns.map(column => printable(column.value(row))));
}

export function buildPdfContentPlan<T extends Record<string, unknown>>(title: string, columns: ReportColumn<T>[], rows: T[]) {
  const createdAt = arabicDateParts();
  return {
    brand: "REVERSE TECH",
    headerArabic: "نظام إدارة المخزن",
    title,
    createdDate: `تاريخ الإنشاء: ${createdAt.date}`,
    createdTime: `وقت الإنشاء: ${createdAt.time}`,
    footerArabic: "وثيقة تشغيلية داخلية",
    headers: columns.map(column => column.label),
    rows: buildReportRows(columns, rows),
  };
}

export function buildReportWorkbook<T extends Record<string, unknown>>(title: string, columns: ReportColumn<T>[], rows: T[]) {
  const dataRows = buildReportRows(columns, rows);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["REVERSE TECH | نظام إدارة المخزن"],
    [title],
    [`تاريخ الإنشاء: ${arabicDate()}`],
    ["ملف رسمي للاستخدام الداخلي والمراجعة التشغيلية"],
    [],
    columns.map(column => column.label),
    ...dataRows,
  ]);

  const lastColumn = Math.max(columns.length - 1, 0);
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumn } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastColumn } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastColumn } },
  ];
  worksheet["!cols"] = columns.map((column, index) => columnWidth(column.label, dataRows.map(row => row[index] ?? "")));
  worksheet["!rows"] = [{ hpt: 28 }, { hpt: 24 }, { hpt: 20 }, { hpt: 18 }, { hpt: 8 }, { hpt: 24 }];
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: Math.max(5, 5 + dataRows.length), c: lastColumn } }) };

  const brandTitleStyle = { font: { name: "Arial", bold: true, sz: 16, color: { rgb: BRAND.white } }, fill: { fgColor: { rgb: BRAND.navy } }, alignment: { horizontal: "right", vertical: "center", readingOrder: 2 } };
  const reportTitleStyle = { font: { name: "Arial", bold: true, sz: 14, color: { rgb: BRAND.navy } }, fill: { fgColor: { rgb: "E7F3FE" } }, alignment: { horizontal: "right", vertical: "center", readingOrder: 2 } };
  const metadataStyle = { font: { name: "Arial", sz: 10, color: { rgb: BRAND.muted } }, alignment: { horizontal: "right", vertical: "center", readingOrder: 2 } };
  const headerStyle = { font: { name: "Arial", bold: true, sz: 10, color: { rgb: BRAND.white } }, fill: { fgColor: { rgb: BRAND.blue } }, alignment: { horizontal: "right", vertical: "center", readingOrder: 2, wrapText: true }, border: { top: { style: "thin", color: { rgb: BRAND.blue } }, bottom: { style: "thin", color: { rgb: BRAND.blue } } } };
  const bodyStyle = { font: { name: "Arial", sz: 10, color: { rgb: BRAND.text } }, alignment: { horizontal: "right", vertical: "center", readingOrder: 2, wrapText: true }, border: { bottom: { style: "hair", color: { rgb: BRAND.border } } } };

  setStyle(worksheet, "A1", brandTitleStyle);
  setStyle(worksheet, "A2", reportTitleStyle);
  setStyle(worksheet, "A3", metadataStyle);
  setStyle(worksheet, "A4", metadataStyle);
  columns.forEach((_, columnIndex) => setStyle(worksheet, XLSX.utils.encode_cell({ r: 5, c: columnIndex }), headerStyle));
  dataRows.forEach((_, rowIndex) => {
    columns.forEach((_, columnIndex) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex + 6, c: columnIndex });
      setStyle(worksheet, address, {
        ...bodyStyle,
        fill: { fgColor: { rgb: rowIndex % 2 === 0 ? BRAND.white : BRAND.paleBlue } },
      });
    });
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير REVERSE TECH");
  return { workbook, worksheet };
}

export function applyWorksheetRtlView(xml: string) {
  const rtlSheetView = '<sheetView workbookViewId="0" rightToLeft="1" showGridLines="0"><pane xSplit="0" ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView>';
  return xml.replace(/<sheetView[^>]*\/>/, rtlSheetView);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportReportExcel<T extends Record<string, unknown>>(title: string, filePrefix: string, columns: ReportColumn<T>[], rows: T[]) {
  const { workbook } = buildReportWorkbook(title, columns, rows);
  const xlsxBytes = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true });
  const zip = await JSZip.loadAsync(xlsxBytes);
  const worksheetXml = zip.file("xl/worksheets/sheet1.xml");
  if (worksheetXml) zip.file("xl/worksheets/sheet1.xml", applyWorksheetRtlView(await worksheetXml.async("string")));
  downloadBlob(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), `${filePrefix}-${stamp()}.xlsx`);
}

async function fontAsBase64(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("تعذر تحميل خط التصدير العربي.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

let pdfFontPromise: Promise<string> | null = null;

function registerArabicFont(pdf: jsPDF, fontBase64: string) {
  pdf.addFileToVFS("NotoNaskhArabic-Regular.ttf", fontBase64);
  pdf.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskh", "normal");
  pdf.setFont("NotoNaskh", "normal");
}

export function shapePdfText(pdf: jsPDF, value: string | number | null | undefined) {
  const text = printable(value);
  return /[\u0600-\u06FF]/.test(text) ? pdf.processArabic(text) : text;
}

export function buildReportPdfDocument<T extends Record<string, unknown>>(title: string, columns: ReportColumn<T>[], rows: T[], fontBase64: string) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", putOnlyUsedFonts: true });
  registerArabicFont(pdf, fontBase64);
  const content = buildPdfContentPlan(title, columns, rows);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const right = pageWidth - 42;

  pdf.setFillColor(11, 46, 78);
  pdf.rect(0, 0, pageWidth, 112, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text(content.brand, 42, 37, { align: "left" });
  pdf.setFont("NotoNaskh", "normal");
  pdf.text(shapePdfText(pdf, content.headerArabic), right, 37, { align: "right" });
  pdf.setFontSize(11);
  pdf.text(shapePdfText(pdf, content.title), right, 62, { align: "right" });
  pdf.setTextColor(205, 232, 250);
  pdf.setFontSize(9.5);
  pdf.text(shapePdfText(pdf, content.createdDate), right, 82, { align: "right" });
  pdf.text(shapePdfText(pdf, content.createdTime), right, 100, { align: "right" });

  autoTable(pdf, {
    startY: 132,
    head: [content.headers.map(value => shapePdfText(pdf, value))],
    body: content.rows.map(row => row.map(value => shapePdfText(pdf, value))),
    theme: "grid",
    styles: {
      font: "NotoNaskh",
      fontStyle: "normal",
      fontSize: 8.5,
      cellPadding: { top: 7, right: 8, bottom: 7, left: 8 },
      textColor: [40, 68, 95],
      valign: "middle",
      halign: "right",
      overflow: "linebreak",
      lineColor: [220, 234, 247],
      lineWidth: 0.45,
    },
    headStyles: {
      font: "NotoNaskh",
      fontStyle: "normal",
      fillColor: [1, 120, 212],
      textColor: [255, 255, 255],
      halign: "right",
      minCellHeight: 28,
    },
    alternateRowStyles: { fillColor: [244, 249, 253] },
    margin: { top: 132, right: 42, bottom: 44, left: 42 },
    didParseCell: data => {
      const raw = typeof data.cell.raw === "string" ? data.cell.raw : "";
      if (/^[A-Za-z0-9._/-]+$/.test(raw)) {
        data.cell.styles.font = "helvetica";
        data.cell.styles.fontStyle = "normal";
        data.cell.styles.halign = "left";
      }
    },
    didDrawPage: () => {
      pdf.setTextColor(107, 127, 144);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(content.brand, 42, pageHeight - 20, { align: "left" });
      pdf.setFont("NotoNaskh", "normal");
      pdf.text(shapePdfText(pdf, content.footerArabic), right, pageHeight - 20, { align: "right" });
    },
  });

  return { pdf, content };
}

export async function exportReportPdf<T extends Record<string, unknown>>(title: string, filePrefix: string, columns: ReportColumn<T>[], rows: T[]) {
  pdfFontPromise ??= fontAsBase64(NOTO_NASKH_ARABIC);
  const { pdf } = buildReportPdfDocument(title, columns, rows, await pdfFontPromise);
  pdf.save(`${filePrefix}-${stamp()}.pdf`);
}
