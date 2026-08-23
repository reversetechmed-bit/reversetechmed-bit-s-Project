export type CountLineForApproval = {
  id: number;
  expectedQuantity: number;
  expectedReservedQuantity: number;
  expectedCustodyQuantity: number;
  countedQuantity: number | null;
  part: {
    id: number;
    quantity: number;
    reservedQuantity: number;
    custodyQuantity: number;
    partNumber: string;
    name: string;
    warehouseSection: "components" | "products";
  };
};

export function calculateCountVariance(expectedQuantity: number, countedQuantity: number) {
  if (!Number.isInteger(expectedQuantity) || expectedQuantity < 0) throw new Error("الرصيد المتوقع غير صالح.");
  if (!Number.isInteger(countedQuantity) || countedQuantity < 0) throw new Error("الكمية المعدودة يجب أن تكون رقمًا صحيحًا غير سالب.");
  return countedQuantity - expectedQuantity;
}

export function validateCountEntry(input: { sessionStatus: "draft" | "open" | "submitted" | "approved" | "cancelled"; countedQuantity: number; expectedQuantity: number }) {
  if (input.sessionStatus !== "open") return { ok: false as const, reason: "لا يمكن إدخال العد إلا في جلسة جرد مفتوحة." };
  try {
    return { ok: true as const, varianceQuantity: calculateCountVariance(input.expectedQuantity, input.countedQuantity) };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "بيانات العد غير صالحة." };
  }
}

export function prepareInventoryCountApproval(input: { sessionStatus: "draft" | "open" | "submitted" | "approved" | "cancelled"; lines: CountLineForApproval[]; actorId: number; sessionId: number; countNumber: string; now?: Date }) {
  if (input.sessionStatus !== "submitted") return { ok: false as const, reason: "لا يمكن اعتماد جلسة لم تُرسل للمراجعة." };
  if (!input.lines.length) return { ok: false as const, reason: "جلسة الجرد لا تحتوي على بنود." };
  const now = input.now ?? new Date();
  const adjustments: Array<{ line: CountLineForApproval; quantityAfter: number; transaction: Record<string, unknown> }> = [];

  for (const line of input.lines) {
    if (line.countedQuantity === null) return { ok: false as const, reason: "يجب إدخال كمية معدودة لكل بند قبل الاعتماد." };
    if (line.part.quantity !== line.expectedQuantity || line.part.reservedQuantity !== line.expectedReservedQuantity || line.part.custodyQuantity !== line.expectedCustodyQuantity) {
      return { ok: false as const, reason: `تغيّر رصيد أو حجز ${line.part.name} بعد فتح الجرد. راجع البند أو افتح جلسة جديدة.` };
    }
    if (line.countedQuantity < line.part.reservedQuantity + line.part.custodyQuantity) {
      return { ok: false as const, reason: `لا يمكن اعتماد ${line.part.name} لأن المعدود أقل من المحجوز والعُهدة القائمة.` };
    }
    const variance = calculateCountVariance(line.expectedQuantity, line.countedQuantity);
    if (!variance) continue;
    adjustments.push({
      line,
      quantityAfter: line.countedQuantity,
      transaction: {
        partId: line.part.id,
        inventoryCountSessionId: input.sessionId,
        type: "inventory_count_adjusted",
        quantityDelta: variance,
        quantityBefore: line.part.quantity,
        quantityAfter: line.countedQuantity,
        actorId: input.actorId,
        partNumberSnapshot: line.part.partNumber,
        partNameSnapshot: line.part.name,
        warehouseSectionSnapshot: line.part.warehouseSection,
        details: `فرق جرد معتمد ضمن الجلسة ${input.countNumber}: ${variance > 0 ? "+" : ""}${variance}.`,
        createdAt: now,
      },
    });
  }
  return { ok: true as const, adjustments, approvedAt: now };
}
