import { describe, expect, it } from "vitest";
import { organizationErrorMessage, validateDepartmentForm, validateEmployeeForm } from "../client/src/lib/organizationValidation";

describe("organization form validation", () => {
  it("accepts Arabic and Latin department and employee identifiers before submitting", () => {
    expect(validateDepartmentForm({ name: "معمل الطباعة", code: "طباعة 3D" })).toBeNull();
    expect(validateEmployeeForm({ fullName: "سارة أحمد", email: "sara@example.com", employeeCode: "موظف ١", jobTitle: "مهندسة" })).toBeNull();
  });

  it("returns clear Arabic messages instead of raw validation payloads", () => {
    expect(validateDepartmentForm({ name: "قسم", code: "###" })).toContain("رمز القسم");
    expect(organizationErrorMessage('[{"path":["code"]}]')).toContain("رمز القسم");
  });
});
