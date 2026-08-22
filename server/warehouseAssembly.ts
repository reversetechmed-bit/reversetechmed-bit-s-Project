export type AssemblyPart = {
  id: number;
  partNumber: string;
  name: string;
  quantity: number;
  reservedQuantity: number;
  warehouseSection: "components" | "products";
  productStage: "work_in_progress" | "under_review" | "under_maintenance" | "finished" | "final_operational" | null;
};

export type AssemblyBomLine = {
  componentId: number;
  quantityRequired: number;
  source: AssemblyPart;
};

export function prepareAssemblyCompletion(input: { target: AssemblyPart; bom: AssemblyBomLine[]; quantityToProduce: number; actorId: number; assemblyOrderId: number; assemblyNumber: string }) {
  if (input.target.warehouseSection !== "products" || (input.target.productStage !== "finished" && input.target.productStage !== "final_operational")) {
    return { ok: false as const, reason: "يمكن تحويل التجميع إلى منتج تام أو منتج نهائي فعلي فقط." };
  }
  if (!Number.isInteger(input.quantityToProduce) || input.quantityToProduce <= 0) {
    return { ok: false as const, reason: "كمية الإنتاج يجب أن تكون رقمًا صحيحًا موجبًا." };
  }
  if (!input.bom.length) return { ok: false as const, reason: "لا يمكن تجميع منتج تام بلا قائمة مكونات." };

  const consumed = input.bom.map(line => {
    const quantityConsumed = line.quantityRequired * input.quantityToProduce;
    const availableQuantity = line.source.quantity - line.source.reservedQuantity;
    return { ...line, quantityConsumed, availableQuantity, quantityAfter: line.source.quantity - quantityConsumed };
  });
  const short = consumed.find(line => line.quantityConsumed > line.availableQuantity);
  if (short) return { ok: false as const, reason: `المتاح من ${short.source.name} هو ${short.availableQuantity} فقط، بينما التجميع يحتاج ${short.quantityConsumed}.` };

  const completedAt = new Date();
  return {
    ok: true as const,
    completedAt,
    targetQuantityAfter: input.target.quantity + input.quantityToProduce,
    consumed,
    sourceTransactions: consumed.map(line => ({
      partId: line.source.id,
      assemblyOrderId: input.assemblyOrderId,
      type: "assembly_consumed" as const,
      quantityDelta: -line.quantityConsumed,
      quantityBefore: line.source.quantity,
      quantityAfter: line.quantityAfter,
      actorId: input.actorId,
      partNumberSnapshot: line.source.partNumber,
      partNameSnapshot: line.source.name,
      warehouseSectionSnapshot: line.source.warehouseSection,
      details: `تم استهلاك ${line.quantityConsumed} × ${line.source.name} ضمن أمر التجميع ${input.assemblyNumber}.`,
    })),
    targetTransaction: {
      partId: input.target.id,
      assemblyOrderId: input.assemblyOrderId,
      type: "assembly_produced" as const,
      quantityDelta: input.quantityToProduce,
      quantityBefore: input.target.quantity,
      quantityAfter: input.target.quantity + input.quantityToProduce,
      actorId: input.actorId,
      partNumberSnapshot: input.target.partNumber,
      partNameSnapshot: input.target.name,
      warehouseSectionSnapshot: input.target.warehouseSection,
      details: `تم إنتاج ${input.quantityToProduce} × ${input.target.name} ضمن أمر التجميع ${input.assemblyNumber}.`,
    },
  };
}
