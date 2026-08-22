import { describe, expect, it } from "vitest";
import { createEnrollmentPasscode, enrollmentPasscodeMatches, hashEnrollmentPasscode, isValidEnrollmentPasscode, normalizeEnrollmentPasscode } from "./employeeEnrollment";

describe("employee enrollment passcodes", () => {
  it("normalizes and validates administrator-issued passcodes", () => {
    expect(normalizeEnrollmentPasscode(" rt-1a 2b3c ")).toBe("RT-1A2B3C");
    expect(isValidEnrollmentPasscode("RT-1A2B3C")).toBe(true);
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
});
