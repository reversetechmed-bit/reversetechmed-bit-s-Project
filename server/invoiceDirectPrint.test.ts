import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("direct invoice printing", () => {
  it("provides a visible direct-print control that invokes the browser print flow", () => {
    const source = readFileSync(new URL("../client/src/pages/InvoiceDocument.tsx", import.meta.url), "utf8");
    expect(source).toContain("const printInvoice = () => window.print()");
    expect(source).toContain("طباعة مباشرة");
    expect(source).toContain("onClick={printInvoice}");
  });
});
