import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("registration method presentation", () => {
  it("binds activation to one Admin-created approved email and initial employee code", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("organization.enrollment.claim.useMutation");
    expect(layout).toContain('registration_source: "employee_directory"');
    expect(layout).toContain("اكتب البريد المسجل وكود الدخول نفسه");
    expect(layout).toContain("كود الدخول الذي حدده الأدمن");
    expect(layout).toContain("حد رسائل تأكيد البريد المؤقت في Supabase");
    expect(layout).toContain("الاسم والصلاحية يؤخذان تلقائيًا من ملف الموظف");
    expect(layout).toContain("function canonicalEmployeeCodeForSignIn");
    expect(layout).toContain("/^RT-[A-Z0-9]+(?:-[A-Z0-9]+)+$/");
    expect(layout).toContain("canonicalEmployeeCode !== password");
    expect(layout).not.toContain("requested_role: requestedRole");
  });

  it("does not present phone registration in the sign-up interface", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).not.toContain("رقم هاتف ورمز");
    expect(layout).not.toContain("بوابة رسائل SMS");
  });
});
