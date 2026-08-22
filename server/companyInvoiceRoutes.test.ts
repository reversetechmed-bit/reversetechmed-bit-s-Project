import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(import.meta.dirname, "..");
const source = (file: string) => readFileSync(resolve(project, file), "utf8");

describe("companies and independent invoice routes", () => {
  it("registers the Companies and InvoiceDocument pages in the application and Admin navigation", () => {
    const app = source("client/src/App.tsx"); const layout = source("client/src/components/DashboardLayout.tsx");
    expect(app).toContain('path={"/companies"}'); expect(app).toContain('path={"/invoice/:id"}');
    expect(layout).toContain('label: "الشركات", path: "/companies"');
  });
  it("keeps company/product/BOM actions and independent invoice exports wired to typed tRPC procedures", () => {
    const companies = source("client/src/pages/Companies.tsx"); const invoice = source("client/src/pages/InvoiceDocument.tsx");
    expect(companies).toContain("trpc.organization.companies.create.useMutation"); expect(companies).toContain("trpc.organization.productComponents.replace.useMutation"); expect(companies).toContain("قائمة مكونات المنتج");
    expect(invoice).toContain("trpc.warehouse.invoices.get.useQuery"); expect(invoice).toContain("exportHandoverInvoicePdf"); expect(invoice).toContain("exportHandoverInvoiceExcel");
  });
});
