import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { inventoryCountLines, inventoryCountSessions, inventoryTransactions, parts, warehouseActivities, warehouseAlerts, warehouseSectionValues } from "../../drizzle/schema";
import { getDb } from "../db";
import { router, warehousePermissionProcedure } from "../_core/trpc";
import { prepareInventoryCountApproval, validateCountEntry } from "../warehouseInventoryCounts";

const optionalText = (value?: string) => value?.trim() ? value.trim() : null;
const countNumberDraft = () => `TMP-CNT-${nanoid(12).toUpperCase()}`;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "بيانات الجرد غير متاحة مؤقتًا." });
  return db;
}

export const inventoryCountsRouter = router({
  list: warehousePermissionProcedure("manage_counts").query(async () => {
    const db = await requireDb();
    const [sessions, lines] = await Promise.all([
      db.select().from(inventoryCountSessions).orderBy(desc(inventoryCountSessions.createdAt)),
      db.select().from(inventoryCountLines),
    ]);
    return sessions.map(session => {
      const sessionLines = lines.filter(line => line.sessionId === session.id);
      return { session, totalLines: sessionLines.length, countedLines: sessionLines.filter(line => line.countedQuantity !== null).length, varianceLines: sessionLines.filter(line => line.varianceQuantity !== null && line.varianceQuantity !== 0).length };
    });
  }),

  details: warehousePermissionProcedure("manage_counts").input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const db = await requireDb();
    const [session] = await db.select().from(inventoryCountSessions).where(eq(inventoryCountSessions.id, input.id)).limit(1);
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "جلسة الجرد غير موجودة." });
    const lines = await db.select({ line: inventoryCountLines, part: parts }).from(inventoryCountLines).innerJoin(parts, eq(inventoryCountLines.partId, parts.id)).where(eq(inventoryCountLines.sessionId, input.id)).orderBy(parts.name);
    return { session, lines };
  }),

  create: warehousePermissionProcedure("manage_counts").input(z.object({ warehouseSection: z.enum(warehouseSectionValues).nullable().optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    return db.transaction(async tx => {
      const selectedParts = input.warehouseSection
        ? await tx.select().from(parts).where(eq(parts.warehouseSection, input.warehouseSection))
        : await tx.select().from(parts);
      if (!selectedParts.length) throw new TRPCError({ code: "BAD_REQUEST", message: "لا توجد أصناف ضمن نطاق الجرد المحدد." });
      const now = new Date();
      const inserted = await tx.insert(inventoryCountSessions).values({ countNumber: countNumberDraft(), status: "open", warehouseSection: input.warehouseSection ?? null, openedById: ctx.user.id, openedAt: now, notes: optionalText(input.notes), createdAt: now }).$returningId();
      const id = inserted[0]?.id;
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر فتح جلسة الجرد." });
      const countNumber = `RT-CNT-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${String(id).padStart(5, "0")}`;
      await tx.update(inventoryCountSessions).set({ countNumber }).where(eq(inventoryCountSessions.id, id));
      await tx.insert(inventoryCountLines).values(selectedParts.map(part => ({ sessionId: id, partId: part.id, expectedQuantity: part.quantity, expectedReservedQuantity: part.reservedQuantity, expectedCustodyQuantity: part.custodyQuantity, partNumberSnapshot: part.partNumber, partNameSnapshot: part.name })));
      await tx.insert(warehouseActivities).values({ type: "inventory_count_opened", actorId: ctx.user.id, title: "فتح جلسة جرد", detail: `تم فتح الجرد ${countNumber} بعدد ${selectedParts.length} صنف دون تعديل الأرصدة.`, inventoryCountSessionId: id });
      return { id, countNumber, lineCount: selectedParts.length } as const;
    });
  }),

  recordLine: warehousePermissionProcedure("manage_counts").input(z.object({ sessionId: z.number().int().positive(), lineId: z.number().int().positive(), countedQuantity: z.number().int().min(0), discrepancyReason: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [session] = await db.select().from(inventoryCountSessions).where(eq(inventoryCountSessions.id, input.sessionId)).limit(1);
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "جلسة الجرد غير موجودة." });
    const [line] = await db.select().from(inventoryCountLines).where(and(eq(inventoryCountLines.id, input.lineId), eq(inventoryCountLines.sessionId, session.id))).limit(1);
    if (!line) throw new TRPCError({ code: "NOT_FOUND", message: "بند الجرد غير موجود ضمن الجلسة." });
    const entry = validateCountEntry({ sessionStatus: session.status, countedQuantity: input.countedQuantity, expectedQuantity: line.expectedQuantity });
    if (!entry.ok) throw new TRPCError({ code: "CONFLICT", message: entry.reason });
    await db.update(inventoryCountLines).set({ countedQuantity: input.countedQuantity, varianceQuantity: entry.varianceQuantity, discrepancyReason: optionalText(input.discrepancyReason), countedById: ctx.user.id, countedAt: new Date() }).where(eq(inventoryCountLines.id, line.id));
    return { varianceQuantity: entry.varianceQuantity } as const;
  }),

  submit: warehousePermissionProcedure("manage_counts").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    return db.transaction(async tx => {
      const [session] = await tx.select().from(inventoryCountSessions).where(eq(inventoryCountSessions.id, input.id)).limit(1);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "جلسة الجرد غير موجودة." });
      if (session.status !== "open") throw new TRPCError({ code: "CONFLICT", message: "يمكن إرسال جلسة جرد مفتوحة فقط." });
      const lines = await tx.select().from(inventoryCountLines).where(eq(inventoryCountLines.sessionId, session.id));
      if (!lines.length || lines.some(line => line.countedQuantity === null)) throw new TRPCError({ code: "CONFLICT", message: "أدخل كمية معدودة لكل البنود قبل إرسال الجرد للمراجعة." });
      const submittedAt = new Date();
      await tx.update(inventoryCountSessions).set({ status: "submitted", submittedById: ctx.user.id, submittedAt }).where(eq(inventoryCountSessions.id, session.id));
      await tx.insert(warehouseAlerts).values({ type: "inventory_count_submitted", title: "جرد بانتظار الاعتماد", body: `أُرسل الجرد ${session.countNumber} للمراجعة والاعتماد.`, inventoryCountSessionId: session.id, dedupeKey: `inventory-count-submitted:${session.id}` });
      return { success: true } as const;
    });
  }),

  approve: warehousePermissionProcedure("approve_counts").input(z.object({ id: z.number().int().positive(), approvalNote: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    return db.transaction(async tx => {
      const [session] = await tx.select().from(inventoryCountSessions).where(eq(inventoryCountSessions.id, input.id)).limit(1);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "جلسة الجرد غير موجودة." });
      const lines = await tx.select({ line: inventoryCountLines, part: parts }).from(inventoryCountLines).innerJoin(parts, eq(inventoryCountLines.partId, parts.id)).where(eq(inventoryCountLines.sessionId, session.id));
      const plan = prepareInventoryCountApproval({ sessionStatus: session.status, lines: lines.map(row => ({ ...row.line, part: row.part })), actorId: ctx.user.id, sessionId: session.id, countNumber: session.countNumber });
      if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
      for (const adjustment of plan.adjustments) {
        await tx.update(parts).set({ quantity: adjustment.quantityAfter }).where(eq(parts.id, adjustment.line.part.id));
        await tx.insert(inventoryTransactions).values(adjustment.transaction as any);
      }
      await tx.update(inventoryCountSessions).set({ status: "approved", approvedById: ctx.user.id, approvedAt: plan.approvedAt, approvalNote: optionalText(input.approvalNote) }).where(eq(inventoryCountSessions.id, session.id));
      await tx.insert(warehouseActivities).values({ type: "inventory_count_approved", actorId: ctx.user.id, title: "اعتماد فروقات جرد", detail: `تم اعتماد ${session.countNumber} بعدد ${plan.adjustments.length} فرق رصيد.`, inventoryCountSessionId: session.id });
      await tx.insert(warehouseAlerts).values({ type: "inventory_count_approved", title: "تم اعتماد جرد المخزون", body: `اعتمد الجرد ${session.countNumber} وسجل ${plan.adjustments.length} فرقًا موثقًا.`, inventoryCountSessionId: session.id, dedupeKey: `inventory-count-approved:${session.id}` });
      return { success: true, adjustmentCount: plan.adjustments.length } as const;
    });
  }),

  cancel: warehousePermissionProcedure("manage_counts").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb();
    const [session] = await db.select().from(inventoryCountSessions).where(eq(inventoryCountSessions.id, input.id)).limit(1);
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "جلسة الجرد غير موجودة." });
    if (["approved", "cancelled"].includes(session.status)) throw new TRPCError({ code: "CONFLICT", message: "لا يمكن إلغاء جلسة معتمدة أو ملغاة." });
    await db.update(inventoryCountSessions).set({ status: "cancelled" }).where(eq(inventoryCountSessions.id, session.id));
    return { success: true } as const;
  }),
});
