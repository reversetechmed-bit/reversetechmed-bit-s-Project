import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("registration method presentation", () => {
  it("binds email/password activation to an Admin-created employee profile instead of a requested role", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("organization.enrollment.eligibility.useMutation");
    expect(layout).toContain('registration_source: "employee_directory"');
    expect(layout).toContain("بريد وكلمة مرور");
    expect(layout).toContain("الاسم والصلاحية يؤخذان تلقائيًا من ملف الموظف");
    expect(layout).not.toContain("requested_role: requestedRole");
  });

  it("does not present phone registration in the sign-up interface", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).not.toContain("رقم هاتف ورمز");
    expect(layout).not.toContain("بوابة رسائل SMS");
  });
});
