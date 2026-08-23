type WorkOrderStatus = "draft" | "released" | "in_progress" | "quality_check" | "completed" | "cancelled";
type WorkOrderType = "production" | "repair";

const workOrderTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  draft: ["released", "cancelled"],
  released: ["in_progress", "cancelled"],
  in_progress: ["quality_check", "cancelled"],
  quality_check: ["completed", "in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export function validateWorkOrderTransition(from: WorkOrderStatus, to: WorkOrderStatus) {
  if (!workOrderTransitions[from].includes(to)) return { ok: false as const, reason: "لا يسمح مسار أمر العمل بهذا الانتقال." };
  return { ok: true as const };
}

type WorkOrderSource = {
  id: number;
  sourcePartId: number;
  quantityRequired: number;
  quantityConsumed: number;
  partNumberSnapshot: string;
  partNameSnapshot: string;
  source: { id: number; quantity: number; reservedQuantity: number; custodyQuantity: number; partNumber: string; name: string; warehouseSection: "components" | "products" };
};

export function prepareProductionWorkOrderCompletion(input: {
  status: WorkOrderStatus;
  target: { id: number; quantity: number; partNumber: string; name: string; warehouseSection: "components" | "products" };
  lines: WorkOrderSource[];
  quantityPlanned: number;
  workOrderId: number;
  workOrderNumber: string;
  actorId: number;
  now?: Date;
}) {
  if (input.status !== "quality_check") return { ok: false as const, reason: "لا يمكن إكمال الإنتاج قبل فحص الجودة." };
  if (!Number.isInteger(input.quantityPlanned) || input.quantityPlanned < 1) return { ok: false as const, reason: "كمية الإنتاج غير صالحة." };
  if (!input.lines.length) return { ok: false as const, reason: "لا يمكن إكمال أمر إنتاج بلا لقطة BOM." };
  const now = input.now ?? new Date();
  const consumed: Array<{ line: WorkOrderSource; quantityAfter: number; quantityConsumed: number; transaction: Record<string, unknown> }> = [];
  for (const line of input.lines) {
    if (line.quantityConsumed !== 0) return { ok: false as const, reason: "تم استهلاك بنود هذا الأمر سابقًا ولا يمكن إكماله مرتين." };
    const required = line.quantityRequired;
    const available = line.source.quantity - line.source.reservedQuantity - line.source.custodyQuantity;
    if (available < required) return { ok: false as const, reason: `المتاح من ${line.source.name} لا يكفي لإكمال أمر العمل.` };
    consumed.push({
      line,
      quantityAfter: line.source.quantity - required,
      quantityConsumed: required,
      transaction: {
        partId: line.source.id, workOrderId: input.workOrderId, type: "work_order_consumed", quantityDelta: -required,
        quantityBefore: line.source.quantity, quantityAfter: line.source.quantity - required, actorId: input.actorId,
        partNumberSnapshot: line.source.partNumber, partNameSnapshot: line.source.name, warehouseSectionSnapshot: line.source.warehouseSection,
        details: `استهلاك أمر العمل ${input.workOrderNumber}.`, createdAt: now,
      },
    });
  }
  const targetQuantityAfter = input.target.quantity + input.quantityPlanned;
  return {
    ok: true as const,
    completedAt: now,
    consumed,
    targetQuantityAfter,
    targetTransaction: {
      partId: input.target.id, workOrderId: input.workOrderId, type: "work_order_produced", quantityDelta: input.quantityPlanned,
      quantityBefore: input.target.quantity, quantityAfter: targetQuantityAfter, actorId: input.actorId,
      partNumberSnapshot: input.target.partNumber, partNameSnapshot: input.target.name, warehouseSectionSnapshot: input.target.warehouseSection,
      details: `إنتاج أمر العمل ${input.workOrderNumber}.`, createdAt: now,
    },
  };
}

export function validateDisassemblySource(input: { sourceSerialStatus?: string | null; maintenanceDisposition?: string | null; hasSourcePart: boolean }) {
  if (!input.hasSourcePart && !input.sourceSerialStatus && input.maintenanceDisposition !== "cannibalize") return { ok: false as const, reason: "اختر مصدرًا تسلسليًا أو حالة صيانة معتمدة للتشليح." };
  const assetEligible = input.sourceSerialStatus ? ["in_maintenance", "retired", "scrapped"].includes(input.sourceSerialStatus) : false;
  const caseEligible = input.maintenanceDisposition === "cannibalize";
  if (!assetEligible && !caseEligible) return { ok: false as const, reason: "المصدر غير مؤهل للتشليح؛ يجب أن يكون في صيانة أو متقاعدًا أو تالفًا أو موسومًا للتشليح." };
  return { ok: true as const };
}

export function prepareDisassemblyCompletion(input: {
  status: "draft" | "submitted" | "approved" | "completed" | "cancelled";
  sourceSerialAssetId?: number | null;
  lines: Array<{ id: number; recoveredPart: { id: number; quantity: number; partNumber: string; name: string; warehouseSection: "components" | "products" }; quantityRecovered: number; condition: "serviceable" | "quarantine" | "scrap"; quantityRestocked: number }>;
  disassemblyOrderId: number;
  disassemblyNumber: string;
  actorId: number;
  now?: Date;
}) {
  if (input.status !== "approved") return { ok: false as const, reason: "لا يمكن إكمال التشليح قبل الاعتماد." };
  if (!input.lines.length) return { ok: false as const, reason: "أضف قطعة مستردة واحدة على الأقل قبل الإكمال." };
  const now = input.now ?? new Date();
  const recovered: Array<{ lineId: number; quantityAfter: number; quantityRestocked: number; transaction?: Record<string, unknown> }> = [];
  for (const line of input.lines) {
    if (line.quantityRestocked !== 0) return { ok: false as const, reason: "تمت معالجة بنود هذا التشليح سابقًا." };
    if (!Number.isInteger(line.quantityRecovered) || line.quantityRecovered < 1) return { ok: false as const, reason: "كمية الاسترداد غير صالحة." };
    const quantityRestocked = line.condition === "serviceable" ? line.quantityRecovered : 0;
    recovered.push({
      lineId: line.id,
      quantityAfter: line.recoveredPart.quantity + quantityRestocked,
      quantityRestocked,
      transaction: quantityRestocked ? {
        partId: line.recoveredPart.id, disassemblyOrderId: input.disassemblyOrderId, type: "disassembly_recovered", quantityDelta: quantityRestocked,
        quantityBefore: line.recoveredPart.quantity, quantityAfter: line.recoveredPart.quantity + quantityRestocked, actorId: input.actorId,
        partNumberSnapshot: line.recoveredPart.partNumber, partNameSnapshot: line.recoveredPart.name, warehouseSectionSnapshot: line.recoveredPart.warehouseSection,
        details: `استرداد قابل للاستخدام من التشليح ${input.disassemblyNumber}.`, createdAt: now,
      } : undefined,
    });
  }
  return { ok: true as const, completedAt: now, recovered };
}
