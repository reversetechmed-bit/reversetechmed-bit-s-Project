import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("registration method presentation", () => {
  it("binds activation to a selected Admin-created employee and a verified approved email or passcode", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("organization.enrollment.directory.useQuery");
    expect(layout).toContain("organization.enrollment.claim.useMutation");
    expect(layout).toContain('registration_source: "employee_directory"');
    expect(layout).toContain("اسم الموظف");
    expect(layout).toContain("رمز التفعيل من الأدمن");
    expect(layout).toContain("الاسم والصلاحية يؤخذان تلقائيًا من ملف الموظف");
    expect(layout).not.toContain("requested_role: requestedRole");
  });

  it("does not present phone registration in the sign-up interface", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).not.toContain("رقم هاتف ورمز");
    expect(layout).not.toContain("بوابة رسائل SMS");
  });
});
