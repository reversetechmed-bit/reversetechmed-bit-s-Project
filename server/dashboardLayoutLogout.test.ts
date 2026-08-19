import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard account switch controls", () => {
  const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

  it("renders a direct logout and account-switch action in the desktop sidebar", () => {
    expect(source).toContain("تسجيل الخروج وتبديل الحساب");
    expect(source).toContain('onClick={logout}');
  });

  it("keeps a visible mobile logout action when sidebar navigation is unavailable", () => {
    expect(source).toContain('md:hidden');
    expect(source).toContain('aria-label="تسجيل الخروج وتبديل الحساب"');
  });
});
