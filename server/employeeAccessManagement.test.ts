import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf8");

describe("employee access management", () => {
  it("lets an Admin provision an approved email and initial employee-code password without returning its hash", () => {
    const router = source("server/routers/organization.ts");
    expect(router).toContain("provisionAccess: adminProcedure");
    expect(router).toContain("initialPasswordHash: hashEnrollmentPasscode(initialPassword)");
    expect(router).toContain("const employeeProfileForAdmin");
    const projection = router.slice(router.indexOf("const employeeProfileForAdmin"), router.indexOf("export const organizationRouter"));
    expect(projection).not.toContain("initialPasswordHash");
  });

  it("supports timed suspension and safe access revocation while context blocks inactive, suspended, and revoked profiles", () => {
    const router = source("server/routers/organization.ts");
    const context = source("server/_core/context.ts");
    expect(router).toContain("suspendAccess: adminProcedure");
    expect(router).toContain("reactivateAccess: adminProcedure");
    expect(router).toContain("revokeAccess: adminProcedure");
    expect(context).toContain("employee.suspendedUntil && employee.suspendedUntil > new Date()");
    expect(context).toContain("employee.accessRevokedAt");
  });

  it("presents Admin-code activation and constrained approved-email activation without public role selection", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    const organization = source("client/src/pages/Organization.tsx");
    expect(layout).toContain("كود الدخول من الأدمن");
    expect(layout).toContain("تفعيل بالبريد المعتمد");
    expect(organization).toContain("تجهيز الدخول");
    expect(organization).toContain("إلغاء الوصول");
    expect(layout).not.toContain("requested_role: requestedRole");
  });
});
