import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHandoverInvoicePdfDocument } from "../client/src/lib/handoverInvoiceExport";

const font = readFileSync("/home/ubuntu/webdev-static-assets/NotoNaskhArabic-Regular.ttf").toString("base64");
const record = {
  invoice: {
    invoiceNumber: "INV-AR-001", issuedAt: new Date("2026-08-22T09:30:00Z"), requesterNameSnapshot: "أحمد محمد",
    recipientNameSnapshot: "مريم حسن", recipientDepartmentSnapshot: "الهندسة الطبية", projectReferenceSnapshot: "جهاز مراقبة حيوية",
    partNumberSnapshot: "REV-003", partNameSnapshot: "لوحة تحكم طبية", warehouseSectionSnapshot: "products" as const,
    quantity: 2, purposeSnapshot: "اختبار وتجهيز لوحة الجهاز", requestNoteSnapshot: "يرجى التسليم لقسم الهندسة",
    deliveryNote: "تم التسليم بعد مراجعة الكمية", receiptConfirmedAt: null, receiptConfirmationName: null,
  },
  receiver: { name: "مريم حسن", email: "mariam@example.com" },
};

describe("standalone Arabic handover invoice PDF", () => {
  it("embeds Noto Naskh Arabic and keeps every invoice table on its registered normal style", () => {
    const pdf = buildHandoverInvoicePdfDocument(record, font);
    const bytes = new Uint8Array(pdf.output("arraybuffer"));
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain("%PDF");
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(pdf.getFontList()).toHaveProperty("NotoNaskh");
    const source = readFileSync(new URL("../client/src/lib/handoverInvoiceExport.ts", import.meta.url), "utf8");
    expect(source).toContain('font: "NotoNaskh", fontStyle: "normal"');
    expect(source).not.toContain('fontStyle: "bold"');
  });

  it("creates a readable Arabic artifact with a central invoice identity and Latin part code", () => {
    const artifactPath = process.env.INVOICE_PDF_ARTIFACT || join(tmpdir(), `reverse-tech-invoice-${Date.now()}.pdf`);
    const pdf = buildHandoverInvoicePdfDocument(record, font);
    writeFileSync(artifactPath, Buffer.from(pdf.output("arraybuffer")));
    const extracted = execFileSync("pdftotext", ["-layout", artifactPath, "-"], { encoding: "utf8" });
    expect(extracted).toContain("REVERSE TECH");
    expect(extracted).toContain("INV-AR-001");
    expect(extracted).toContain("REV-003");
    expect(extracted).toMatch(/[\uFB50-\uFDFF\uFE70-\uFEFF]/);
  });
});
