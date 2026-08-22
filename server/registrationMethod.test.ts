import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("registration method presentation", () => {
  it("keeps unlimited email/password registration explicit for both requested roles", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('requested_role: requestedRole');
    expect(layout).toContain("بريد وكلمة مرور");
    expect(layout).toContain("متاح لإنشاء أي عدد من حسابات الأدمن والمستخدمين.");
  });

  it("does not present phone registration in the sign-up interface", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).not.toContain("رقم هاتف ورمز");
    expect(layout).not.toContain("بوابة رسائل SMS");
  });
});
