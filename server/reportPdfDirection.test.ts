import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import { buildPdfContentPlan, buildReportPdfDocument, shapePdfText, type ReportColumn } from "../client/src/lib/reportExport";

describe("Arabic PDF direction regression", () => {
  const source = readFileSync(new URL("../client/src/lib/reportExport.ts", import.meta.url), "utf8");

  it("uses Arabic shaping without enabling a second global RTL reversal", () => {
    expect(source).toContain("pdf.processArabic");
    expect(source).not.toContain("setR2L(true)");
  });

  it("keeps the embedded Noto Naskh Arabic font configured for report tables and headings", () => {
    expect(source).toContain('pdf.addFont("NotoNaskhArabic-Regular.ttf", "NotoNaskh", "normal")');
    expect(source).toContain('font: "NotoNaskh"');
  });

  it("builds explicit Arabic and Latin content segments for the rendered PDF path", () => {
    type Row = { code: string; item: string };
    const columns: ReportColumn<Row>[] = [{ label: "الكود", value: row => row.code }, { label: "العنصر", value: row => row.item }];
    const plan = buildPdfContentPlan("تقرير اختبار", columns, [{ code: "REV-003", item: "الغواصة" }]);

    expect(plan.brand).toBe("REVERSE TECH");
    expect(plan.headerArabic).toBe("نظام إدارة المخزن");
    expect(plan.footerArabic).toBe("وثيقة تشغيلية داخلية");
    expect(plan.createdDate).toContain("تاريخ الإنشاء:");
    expect(plan.createdTime).toContain("وقت الإنشاء:");
    expect(plan.headers).toEqual(["الكود", "العنصر"]);
    expect(plan.rows).toEqual([["REV-003", "الغواصة"]]);
  });

  it("passes real Arabic, date, and Latin code strings through the jsPDF shaping path without reversing Latin codes", () => {
    const pdf = new jsPDF();
    const arabicHeader = shapePdfText(pdf, "نظام إدارة المخزن");
    const arabicDate = shapePdfText(pdf, "تاريخ الإنشاء: ١٩/٠٨/٢٠٢٦، ٨:٤٤ ص");
    const latinCode = shapePdfText(pdf, "REV-003");

    expect(arabicHeader).not.toBe("نظام إدارة المخزن");
    expect(arabicHeader).toMatch(/[\uFB50-\uFDFF\uFE70-\uFEFF]/);
    expect(arabicDate).toMatch(/[\uFB50-\uFDFF\uFE70-\uFEFF]/);
    expect(latinCode).toBe("REV-003");
  });

  it("builds a real PDF artifact with the embedded Arabic font and mixed report content", () => {
    type Row = { code: string; item: string; quantity: number };
    const columns: ReportColumn<Row>[] = [{ label: "الكود", value: row => row.code }, { label: "العنصر", value: row => row.item }, { label: "الكمية", value: row => row.quantity }];
    const font = readFileSync("/home/ubuntu/webdev-static-assets/NotoNaskhArabic-Regular.ttf").toString("base64");
    const { pdf, content } = buildReportPdfDocument("تقرير اختبار نهائي", columns, [{ code: "REV-003", item: "الغواصة", quantity: 4 }], font);
    const bytes = new Uint8Array(pdf.output("arraybuffer"));

    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain("%PDF");
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(pdf.getFontList()).toHaveProperty("NotoNaskh");
    expect(content.rows).toEqual([["REV-003", "الغواصة", "4"]]);
    expect(content.footerArabic).toBe("وثيقة تشغيلية داخلية");
  });

  it("extracts Latin codes and the REVERSE TECH identity from a generated PDF artifact", () => {
    type Row = { code: string; item: string; quantity: number };
    const columns: ReportColumn<Row>[] = [{ label: "الكود", value: row => row.code }, { label: "العنصر", value: row => row.item }, { label: "الكمية", value: row => row.quantity }];
    const font = readFileSync("/home/ubuntu/webdev-static-assets/NotoNaskhArabic-Regular.ttf").toString("base64");
    const { pdf } = buildReportPdfDocument("تقرير اختبار نهائي", columns, [{ code: "REV-003", item: "الغواصة", quantity: 4 }], font);
    const artifactPath = join(tmpdir(), `reverse-tech-export-${Date.now()}.pdf`);
    writeFileSync(artifactPath, Buffer.from(pdf.output("arraybuffer")));

    try {
      const extracted = execFileSync("pdftotext", ["-layout", artifactPath, "-"], { encoding: "utf8" });
      expect(extracted).toContain("REVERSE TECH");
      expect(extracted).toContain("REV-003");
      expect(extracted).toMatch(/[\uFB50-\uFDFF\uFE70-\uFEFF]/);
    } finally {
      unlinkSync(artifactPath);
    }
  });
});
