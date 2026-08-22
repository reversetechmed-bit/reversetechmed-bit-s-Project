import { describe, expect, it } from "vitest";
import { createEnrollmentPasscode, enrollmentPasscodeMatches, hashEnrollmentPasscode, isValidEnrollmentPasscode, normalizeEnrollmentPasscode } from "./employeeEnrollment";

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
});
