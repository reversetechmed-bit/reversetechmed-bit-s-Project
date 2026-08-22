import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

export function normalizeEnrollmentPasscode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidEnrollmentPasscode(value: string) {
  return /^[A-Z0-9-]{6,32}$/.test(normalizeEnrollmentPasscode(value));
}

export function createEnrollmentPasscode() {
  return `RT-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function hashEnrollmentPasscode(value: string) {
  return createHmac("sha256", ENV.cookieSecret).update(normalizeEnrollmentPasscode(value)).digest("hex");
}

export function enrollmentPasscodeMatches(value: string, hash: string) {
  const candidate = Buffer.from(hashEnrollmentPasscode(value), "hex");
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
