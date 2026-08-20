import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("registration method presentation", () => {
  it("keeps unlimited email/password registration explicit for both requested roles", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('requested_role: requestedRole');
    expect(layout).toContain("بريد وكلمة مرور");
    expect(layout).toContain("متاح لإنشاء أي عدد من الحسابات.");
    expect(layout).toContain("التسجيل بالبريد وكلمة المرور مفتوح للأدمن والمستخدم.");
  });

  it("does not present phone registration as ready until the SMS provider is enabled", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("رقم هاتف ورمز");
    expect(layout).toContain("يتطلب تفعيل بوابة رسائل SMS أولًا.");
  });
});
