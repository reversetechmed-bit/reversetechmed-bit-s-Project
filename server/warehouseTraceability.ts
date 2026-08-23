import type { serialAssetStatusValues } from "../drizzle/schema";

export type SerialAssetStatus = (typeof serialAssetStatusValues)[number];

const barcodePattern = /^[A-Z0-9-]{4,100}$/;

export function normalizeWarehouseBarcode(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");
  if (!barcodePattern.test(normalized)) throw new Error("صيغة الباركود يجب أن تتكون من أحرف إنجليزية كبيرة أو أرقام أو شرطات.");
  return normalized;
}

export function barcodeCheckDigit(value: string) {
  const sum = Array.from(value).reduce((total, character, index) => total + character.charCodeAt(0) * (index % 2 === 0 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export function makePartBarcode(part: { id: number; partNumber: string }) {
  const compactPartNumber = part.partNumber.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 68) || "ITEM";
  const base = `RTWMS-P-${compactPartNumber}-${String(part.id).padStart(6, "0")}`;
  return `${base}-${barcodeCheckDigit(base)}`;
}

export function makeLocationBarcode(location: { id: number; code: string }) {
  const compactCode = location.code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 68) || "LOC";
  const base = `RTWMS-L-${compactCode}-${String(location.id).padStart(6, "0")}`;
  return `${base}-${barcodeCheckDigit(base)}`;
}

export function makeQrPayload(kind: "part" | "location" | "asset", value: string) {
  const normalized = kind === "asset" ? value.trim().toUpperCase() : normalizeWarehouseBarcode(value);
  if (!normalized) throw new Error("لا يمكن إنشاء QR بدون قيمة تعريفية.");
  return `RTWMS:${kind.toUpperCase()}:${encodeURIComponent(normalized)}`;
}

const allowedTransitions: Record<SerialAssetStatus, SerialAssetStatus[]> = {
  in_stock: ["in_custody", "in_maintenance", "in_production", "installed", "retired", "scrapped"],
  in_custody: ["in_stock", "in_maintenance", "retired", "scrapped"],
  in_maintenance: ["in_stock", "in_production", "cannibalized", "retired", "scrapped"],
  in_production: ["in_stock", "in_maintenance", "cannibalized", "scrapped"],
  installed: ["in_maintenance", "retired", "cannibalized", "scrapped"],
  retired: ["cannibalized", "scrapped"],
  cannibalized: [],
  scrapped: [],
};

export function validateSerialTransition(input: { from: SerialAssetStatus; to: SerialAssetStatus; currentHolderId?: number | null }) {
  if (input.from === input.to) return { ok: false as const, reason: "الوحدة بالفعل في الحالة المحددة." };
  if (!allowedTransitions[input.from].includes(input.to)) return { ok: false as const, reason: "لا تسمح دورة حياة الوحدة بالانتقال المطلوب." };
  if (input.to === "in_custody" && !input.currentHolderId) return { ok: false as const, reason: "تتطلب حالة العُهدة تحديد الحائز الحالي." };
  if (input.to !== "in_custody" && input.currentHolderId) return { ok: false as const, reason: "لا يمكن الاحتفاظ بحائز للوحدة خارج حالة العُهدة." };
  return { ok: true as const };
}

export function serialEventTypeForTransition(to: SerialAssetStatus) {
  if (to === "in_custody") return "custody_issued" as const;
  if (to === "in_stock") return "custody_returned" as const;
  if (to === "in_maintenance") return "maintenance_opened" as const;
  if (to === "in_production") return "work_started" as const;
  if (to === "installed") return "installed" as const;
  if (to === "cannibalized") return "disassembled" as const;
  if (to === "retired" || to === "scrapped") return "retired" as const;
  return "moved" as const;
}
