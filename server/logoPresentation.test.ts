import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("REVERSE TECH logo presentation", () => {
  it("keeps the enlarged sign-in logo and the branded sidebar identity block", () => {
    const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
    expect(source).toContain("h-12 w-auto object-contain sm:h-14");
    expect(source).toContain("REVERSE TECH</p>");
    expect(source).toContain("المخزون والطلبات");
  });
});
