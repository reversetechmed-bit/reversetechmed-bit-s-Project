import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("REVERSE TECH application identity", () => {
  it("uses the warehouse icon in the sign-in and sidebar identity blocks instead of the previous logo image", () => {
    const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
    expect(source).toContain('const WAREHOUSE_APP_ICON = "/manus-storage/reverse-tech-warehouse-icon-hq_0336c499.png"');
    expect(source).toContain("group-hover:-rotate-3 group-hover:scale-110");
    expect(source).not.toContain("reverse-tech-logo_04d48f19");
    expect(source).toContain("نظام المخزن</p>");
    expect(source).toContain("المخزون والطلبات");
  });
});
