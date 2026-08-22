import { describe, expect, it } from "vitest";
import { createEnrollmentPasscode, enrollmentPasscodeMatches, evaluateEmployeeEnrollmentClaim, hashEnrollmentPasscode, isValidEnrollmentPasscode, normalizeEnrollmentPasscode } from "./employeeEnrollment";

describe("employee enrollment passcodes", () => {
  it("normalizes and validates administrator-issued passcodes", () => {
    expect(normalizeEnrollmentPasscode(" rt-1a 2b3c ")).toBe("RT-1A2B3C");
    expect(isValidEnrollmentPasscode("RT-1A2B3C")).toBe(true);
    expect(isValidEnrollmentPasscode("RT-" + "A".repeat(61))).toBe(true);
    expect(isValidEnrollmentPasscode("RT-" + "A".repeat(62))).toBe(false);
    expect(isValidEnrollmentPasscode("short")).toBe(false);
    expect(isValidEnrollmentPasscode("RT-!INVALID")).toBe(false);
  });

  it("stores only a verifiable hash and generates a shareable passcode", () => {
    const passcode = createEnrollmentPasscode();
    const hash = hashEnrollmentPasscode(passcode);
    expect(passcode).toMatch(/^RT-[A-F0-9]{8}$/);
    expect(hash).not.toContain(passcode);
    expect(enrollmentPasscodeMatches(passcode, hash)).toBe(true);
    expect(enrollmentPasscodeMatches("RT-00000000", hash)).toBe(false);
  });

  it("verifies independent codes for an unrestricted set of employee activation records", () => {
    const employees = Array.from({ length: 24 }, (_, index) => ({ code: `RT-EMP-${String(index + 1).padStart(3, "0")}`, hash: "" }));
    const prepared = employees.map(employee => ({ ...employee, hash: hashEnrollmentPasscode(employee.code) }));
    expect(prepared.every(employee => enrollmentPasscodeMatches(employee.code, employee.hash))).toBe(true);
    expect(prepared.every(employee => !enrollmentPasscodeMatches("RT-EMP-999", employee.hash))).toBe(true);
  });

  it("returns a precise and safe eligibility decision for every employee activation state", () => {
    const code = "RT-ENG-CLAIM";
    const readyEmployee = { isActive: 1, accessRevokedAt: null, suspendedUntil: null, userId: null, initialPasswordHash: hashEnrollmentPasscode(code), fullName: "Employee", warehouseRole: "user" };
    const now = new Date("2026-08-22T10:00:00.000Z");

    expect(evaluateEmployeeEnrollmentClaim(null, code, now).message).toContain("غير مسجل");
    expect(evaluateEmployeeEnrollmentClaim({ ...readyEmployee, isActive: 0 }, code, now).message).toContain("غير نشط");
    expect(evaluateEmployeeEnrollmentClaim({ ...readyEmployee, suspendedUntil: new Date("2026-08-23T10:00:00.000Z") }, code, now).message).toContain("معلّق");
    expect(evaluateEmployeeEnrollmentClaim({ ...readyEmployee, userId: 42 }, code, now).message).toContain("حساب مفعّل بالفعل");
    expect(evaluateEmployeeEnrollmentClaim({ ...readyEmployee, initialPasswordHash: null }, code, now).message).toContain("لم يصدر الأدمن");
    expect(evaluateEmployeeEnrollmentClaim(readyEmployee, "not valid!", now).message).toContain("صيغة كود الدخول");
    expect(evaluateEmployeeEnrollmentClaim(readyEmployee, "RT-ENG-WRONG", now).message).toContain("لا يطابق");
    expect(evaluateEmployeeEnrollmentClaim(readyEmployee, " rt-eng-claim ", now)).toMatchObject({ eligible: true, fullName: "Employee", warehouseRole: "user", method: "admin_credentials" });
  });
});
