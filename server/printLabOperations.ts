export type PrintLabMaterialBalance = {
  id: number;
  name: string;
  availableGrams: number;
};

export type PrintLabMovementType = "inbound" | "consumed" | "returned" | "adjustment_in" | "adjustment_out";

const inboundMovementTypes = new Set<PrintLabMovementType>(["inbound", "returned", "adjustment_in"]);

export function preparePrintLabMaterialMovement(input: {
  material: PrintLabMaterialBalance;
  type: PrintLabMovementType;
  grams: number;
  reason: string;
}) {
  if (!Number.isInteger(input.grams) || input.grams <= 0) {
    return { ok: false as const, reason: "كمية الفيلمنت يجب أن تكون عددًا صحيحًا موجبًا بالجرام." };
  }
  if (!input.reason.trim()) return { ok: false as const, reason: "سبب حركة الفيلمنت إلزامي." };

  const gramsDelta = inboundMovementTypes.has(input.type) ? input.grams : -input.grams;
  const availableGramsAfter = input.material.availableGrams + gramsDelta;
  if (availableGramsAfter < 0) {
    return { ok: false as const, reason: `المتاح من ${input.material.name} هو ${input.material.availableGrams} جم فقط.` };
  }

  return {
    ok: true as const,
    gramsDelta,
    availableGramsAfter,
  };
}
