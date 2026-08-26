import { describe, expect, it } from "vitest";
import { preparePrintLabMaterialMovement } from "./printLabOperations";

describe("print lab filament gram movements", () => {
  const material = { id: 1, name: "PLA طبي أبيض", availableGrams: 750 };

  it("adds grams for an inbound spool movement", () => {
    expect(preparePrintLabMaterialMovement({ material, type: "inbound", grams: 250, reason: "استلام بكرة جديدة" })).toMatchObject({
      ok: true,
      gramsDelta: 250,
      availableGramsAfter: 1000,
    });
  });

  it("deducts only the documented grams for a printing run", () => {
    expect(preparePrintLabMaterialMovement({ material, type: "consumed", grams: 128, reason: "تشغيل أمر طباعة" })).toMatchObject({
      ok: true,
      gramsDelta: -128,
      availableGramsAfter: 622,
    });
  });

  it("rejects a print run that would make a filament balance negative", () => {
    expect(preparePrintLabMaterialMovement({ material, type: "consumed", grams: 751, reason: "تشغيل أمر طباعة" })).toEqual({
      ok: false,
      reason: "المتاح من PLA طبي أبيض هو 750 جم فقط.",
    });
  });

  it("requires a positive whole-gram amount and an audit reason", () => {
    expect(preparePrintLabMaterialMovement({ material, type: "adjustment_out", grams: 0, reason: "تسوية" })).toEqual({
      ok: false,
      reason: "كمية الفيلمنت يجب أن تكون عددًا صحيحًا موجبًا بالجرام.",
    });
    expect(preparePrintLabMaterialMovement({ material, type: "adjustment_out", grams: 5, reason: "   " })).toEqual({
      ok: false,
      reason: "سبب حركة الفيلمنت إلزامي.",
    });
  });
});
