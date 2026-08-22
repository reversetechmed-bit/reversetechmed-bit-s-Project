import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

export function normalizeEnrollmentPasscode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidEnrollmentPasscode(value: string) {
  return /^[A-Z0-9-]{6,64}$/.test(normalizeEnrollmentPasscode(value));
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

type EnrollmentEmployee = {
  isActive: number | boolean;
  accessRevokedAt: Date | null;
  suspendedUntil: Date | null;
  userId: number | null;
  initialPasswordHash: string | null;
  fullName: string;
  warehouseRole: string;
};

export function evaluateEmployeeEnrollmentClaim(employee: EnrollmentEmployee | null, passcode: string, now = new Date()) {
  if (!employee) return { eligible: false as const, message: "هذا البريد غير مسجل في دليل الموظفين. راجع الأدمن للتأكد من البريد المعتمد." };
  if (!employee.isActive || employee.accessRevokedAt) return { eligible: false as const, message: "وصول هذا الموظف غير نشط حاليًا. راجع مسؤول المخزن." };
  if (employee.suspendedUntil && employee.suspendedUntil > now) return { eligible: false as const, message: "هذا الحساب معلّق مؤقتًا. راجع مسؤول المخزن." };
  if (employee.userId) return { eligible: false as const, message: "هذا البريد لديه حساب مفعّل بالفعل. استخدم «تسجيل الدخول» بدل تفعيل الحساب." };
  if (!employee.initialPasswordHash) return { eligible: false as const, message: "لم يصدر الأدمن كود دخول لهذا البريد بعد. اطلب منه الضغط على «تجهيز الدخول»." };
  if (!isValidEnrollmentPasscode(passcode)) return { eligible: false as const, message: "صيغة كود الدخول غير صحيحة. استخدم 6 إلى 64 حرفًا أو رقمًا أو شرطة فقط." };
  if (!enrollmentPasscodeMatches(passcode, employee.initialPasswordHash)) return { eligible: false as const, message: "كود الدخول لا يطابق الكود الذي جهزه الأدمن لهذا البريد. أعد نسخ الكود بلا مسافات أو اطلب من الأدمن إعادة تجهيزه." };
  return { eligible: true as const, message: "تم التحقق من بيانات الموظف. أنشئ كلمة مرور جديدة أو أكمل التفعيل.", fullName: employee.fullName, warehouseRole: employee.warehouseRole, method: "admin_credentials" as const };
}
