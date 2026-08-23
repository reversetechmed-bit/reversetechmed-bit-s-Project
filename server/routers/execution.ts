import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { disassemblyLines, disassemblyOrders, disassemblyStatusValues, inventoryTransactions, maintenanceCases, parts, productComponents, serialAssetEvents, serialAssets, warehouseActivities, warehouseAlerts, workOrderLines, workOrders, workOrderStatusValues, workOrderTypeValues } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, router, warehousePermissionProcedure } from "../_core/trpc";
import { prepareDisassemblyCompletion, prepareProductionWorkOrderCompletion, validateDisassemblySource, validateWorkOrderTransition } from "../warehouseExecution";

const optionalText = (value?: string) => value?.trim() ? value.trim() : null;
const workNumberDraft = () => `TMP-WO-${nanoid(12).toUpperCase()}`;
const disassemblyNumberDraft = () => `TMP-DS-${nanoid(12).toUpperCase()}`;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "بيانات التنفيذ غير متاحة مؤقتًا." });
  return db;
}

const workOrderCreateInput = z.object({
  type: z.enum(workOrderTypeValues),
  targetPartId: z.number().int().positive(),
  serialAssetId: z.number().int().positive().nullable().optional(),
  quantityPlanned: z.number().int().positive().default(1),
  assigneeId: z.number().int().positive().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  dueAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const disassemblyCreateInput = z.object({
  sourceSerialAssetId: z.number().int().positive().nullable().optional(),
  sourceMaintenanceCaseId: z.number().int().positive().nullable().optional(),
  reason: z.string().trim().min(3).max(2000),
  notes: z.string().trim().max(2000).optional(),
  lines: z.array(z.object({ recoveredPartId: z.number().int().positive(), quantityRecovered: z.number().int().positive(), condition: z.enum(["serviceable", "quarantine", "scrap"]), inspectionNote: z.string().trim().max(2000).optional() })).min(1).max(100),
});

export const executionRouter = router({
  workOrders: router({
    list: warehousePermissionProcedure("manage_work_orders").query(async () => {
      const db = await requireDb();
      const [orders, lines] = await Promise.all([db.select({ order: workOrders, target: parts }).from(workOrders).innerJoin(parts, eq(workOrders.targetPartId, parts.id)).orderBy(desc(workOrders.createdAt)), db.select({ line: workOrderLines, source: parts }).from(workOrderLines).innerJoin(parts, eq(workOrderLines.sourcePartId, parts.id))]);
      return orders.map(order => ({ ...order, lines: lines.filter(line => line.line.workOrderId === order.order.id) }));
    }),
    create: warehousePermissionProcedure("manage_work_orders").input(workOrderCreateInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [target] = await tx.select().from(parts).where(eq(parts.id, input.targetPartId)).limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف المستهدف غير موجود." });
        if (input.type === "production" && target.warehouseSection !== "products") throw new TRPCError({ code: "BAD_REQUEST", message: "أمر الإنتاج يتطلب منتجًا مستهدفًا من قسم المنتجات." });
        if (input.type === "production" && input.serialAssetId) throw new TRPCError({ code: "BAD_REQUEST", message: "سجّل الوحدة الناتجة بعد إكمال الإنتاج؛ لا يمكن ربط أمر إنتاج بوحدة موجودة." });
        if (input.serialAssetId) {
          const [asset] = await tx.select().from(serialAssets).where(eq(serialAssets.id, input.serialAssetId)).limit(1);
          if (!asset || asset.partId !== target.id) throw new TRPCError({ code: "BAD_REQUEST", message: "الوحدة التسلسلية لا تنتمي إلى الصنف المستهدف." });
        }
        const now = new Date();
        const inserted = await tx.insert(workOrders).values({ workOrderNumber: workNumberDraft(), type: input.type, targetPartId: target.id, serialAssetId: input.serialAssetId ?? null, quantityPlanned: input.quantityPlanned, assigneeId: input.assigneeId ?? null, priority: input.priority, dueAt: input.dueAt ? new Date(input.dueAt) : null, notes: optionalText(input.notes), createdById: ctx.user.id, createdAt: now }).$returningId();
        const id = inserted[0]?.id;
        if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء أمر العمل." });
        const workOrderNumber = `RT-WO-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${String(id).padStart(5, "0")}`;
        await tx.update(workOrders).set({ workOrderNumber }).where(eq(workOrders.id, id));
        await tx.insert(warehouseActivities).values({ type: "work_order_updated", actorId: ctx.user.id, title: "إنشاء أمر عمل", detail: `تم إنشاء ${workOrderNumber} للصنف ${target.name}.`, partId: target.id, workOrderId: id });
        return { id, workOrderNumber } as const;
      });
    }),
    transition: warehousePermissionProcedure("manage_work_orders").input(z.object({ id: z.number().int().positive(), status: z.enum(workOrderStatusValues), qualityOutcome: z.string().trim().max(64).optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [order] = await tx.select().from(workOrders).where(eq(workOrders.id, input.id)).limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "أمر العمل غير موجود." });
        const transition = validateWorkOrderTransition(order.status, input.status);
        if (!transition.ok) throw new TRPCError({ code: "CONFLICT", message: transition.reason });
        if (input.status === "released" && order.type === "production") {
          const bom = await tx.select({ component: productComponents, source: parts }).from(productComponents).innerJoin(parts, eq(productComponents.componentId, parts.id)).where(eq(productComponents.productId, order.targetPartId));
          if (!bom.length) throw new TRPCError({ code: "CONFLICT", message: "لا يمكن إصدار أمر إنتاج دون قائمة مواد BOM." });
          await tx.insert(workOrderLines).values(bom.map(row => ({ workOrderId: order.id, sourcePartId: row.source.id, quantityPerUnit: row.component.quantityRequired, quantityRequired: row.component.quantityRequired * order.quantityPlanned, partNumberSnapshot: row.source.partNumber, partNameSnapshot: row.source.name })));
        }
        const now = new Date();
        if (input.status === "in_progress" && order.type === "repair" && order.serialAssetId) {
          const [asset] = await tx.select().from(serialAssets).where(eq(serialAssets.id, order.serialAssetId)).limit(1);
          if (!asset || !["in_stock", "installed", "in_maintenance"].includes(asset.status)) throw new TRPCError({ code: "CONFLICT", message: "الوحدة التسلسلية ليست في حالة تسمح ببدء الإصلاح." });
          if (asset.status !== "in_maintenance") {
            await tx.update(serialAssets).set({ status: "in_maintenance", currentHolderId: null }).where(eq(serialAssets.id, asset.id));
            await tx.insert(serialAssetEvents).values({ serialAssetId: asset.id, type: "maintenance_opened", fromStatus: asset.status, toStatus: "in_maintenance", locationId: asset.locationId, actorId: ctx.user.id, note: `بدء إصلاح ${order.workOrderNumber}.` });
          }
        }
        await tx.update(workOrders).set({ status: input.status, releasedAt: input.status === "released" ? now : order.releasedAt, startedAt: input.status === "in_progress" ? now : order.startedAt, qualityCheckedById: input.status === "quality_check" ? ctx.user.id : order.qualityCheckedById, qualityCheckedAt: input.status === "quality_check" ? now : order.qualityCheckedAt, qualityOutcome: optionalText(input.qualityOutcome) ?? order.qualityOutcome, notes: optionalText(input.notes) ?? order.notes }).where(eq(workOrders.id, order.id));
        await tx.insert(warehouseActivities).values({ type: "work_order_updated", actorId: ctx.user.id, title: "تحديث أمر عمل", detail: `انتقل ${order.workOrderNumber} إلى ${input.status}.`, workOrderId: order.id, partId: order.targetPartId });
        return { success: true } as const;
      });
    }),
    complete: warehousePermissionProcedure("manage_work_orders").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [record] = await tx.select({ order: workOrders, target: parts }).from(workOrders).innerJoin(parts, eq(workOrders.targetPartId, parts.id)).where(eq(workOrders.id, input.id)).limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "أمر العمل غير موجود." });
        if (record.order.type === "production") {
          const sourceRows = await tx.select({ line: workOrderLines, source: parts }).from(workOrderLines).innerJoin(parts, eq(workOrderLines.sourcePartId, parts.id)).where(eq(workOrderLines.workOrderId, record.order.id));
          const plan = prepareProductionWorkOrderCompletion({ status: record.order.status, target: record.target, lines: sourceRows.map(row => ({ ...row.line, source: row.source })), quantityPlanned: record.order.quantityPlanned, workOrderId: record.order.id, workOrderNumber: record.order.workOrderNumber, actorId: ctx.user.id });
          if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
          for (const consumed of plan.consumed) { await tx.update(parts).set({ quantity: consumed.quantityAfter }).where(eq(parts.id, consumed.line.source.id)); await tx.update(workOrderLines).set({ quantityConsumed: consumed.quantityConsumed }).where(eq(workOrderLines.id, consumed.line.id)); await tx.insert(inventoryTransactions).values(consumed.transaction as any); }
          await tx.update(parts).set({ quantity: plan.targetQuantityAfter }).where(eq(parts.id, record.target.id));
          await tx.insert(inventoryTransactions).values(plan.targetTransaction as any);
          await tx.update(workOrders).set({ status: "completed", completedById: ctx.user.id, completedAt: plan.completedAt }).where(eq(workOrders.id, record.order.id));
        } else {
          if (record.order.status !== "quality_check") throw new TRPCError({ code: "CONFLICT", message: "لا يمكن إكمال الإصلاح قبل فحص الجودة." });
          await tx.update(workOrders).set({ status: "completed", completedById: ctx.user.id, completedAt: new Date() }).where(eq(workOrders.id, record.order.id));
          if (record.order.serialAssetId) {
            const [asset] = await tx.select().from(serialAssets).where(eq(serialAssets.id, record.order.serialAssetId)).limit(1);
            if (asset?.status === "in_maintenance") { await tx.update(serialAssets).set({ status: "in_stock", currentHolderId: null }).where(eq(serialAssets.id, asset.id)); await tx.insert(serialAssetEvents).values({ serialAssetId: asset.id, type: "work_completed", fromStatus: "in_maintenance", toStatus: "in_stock", locationId: asset.locationId, actorId: ctx.user.id, note: `إكمال إصلاح ${record.order.workOrderNumber}.` }); }
          }
        }
        await tx.insert(warehouseActivities).values({ type: "work_order_completed", actorId: ctx.user.id, title: "إكمال أمر عمل", detail: `تم إكمال ${record.order.workOrderNumber}.`, workOrderId: record.order.id, partId: record.target.id });
        await tx.insert(warehouseAlerts).values({ type: "work_order_completed", title: "تم إكمال أمر عمل", body: `تم إكمال أمر العمل ${record.order.workOrderNumber}.`, workOrderId: record.order.id, dedupeKey: `work-order-complete:${record.order.id}` });
        return { success: true } as const;
      });
    }),
  }),

  disassembly: router({
    list: warehousePermissionProcedure("manage_disassembly").query(async () => {
      const db = await requireDb();
      const [orders, lines] = await Promise.all([db.select().from(disassemblyOrders).orderBy(desc(disassemblyOrders.createdAt)), db.select({ line: disassemblyLines, recoveredPart: parts }).from(disassemblyLines).innerJoin(parts, eq(disassemblyLines.recoveredPartId, parts.id))]);
      return orders.map(order => ({ order, lines: lines.filter(line => line.line.disassemblyOrderId === order.id) }));
    }),
    create: warehousePermissionProcedure("manage_disassembly").input(disassemblyCreateInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      if (!input.sourceSerialAssetId && !input.sourceMaintenanceCaseId) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر وحدة تسلسلية أو حالة صيانة موسومة للتشليح كمصدر." });
      if (new Set(input.lines.map(line => line.recoveredPartId)).size !== input.lines.length) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تكرار القطعة المستردة ضمن التشليح نفسه." });
      return db.transaction(async tx => {
        const [asset] = input.sourceSerialAssetId ? await tx.select().from(serialAssets).where(eq(serialAssets.id, input.sourceSerialAssetId)).limit(1) : [undefined];
        const [maintenance] = input.sourceMaintenanceCaseId ? await tx.select().from(maintenanceCases).where(eq(maintenanceCases.id, input.sourceMaintenanceCaseId)).limit(1) : [undefined];
        if (input.sourceSerialAssetId && !asset) throw new TRPCError({ code: "NOT_FOUND", message: "الوحدة التسلسلية المصدر غير موجودة." });
        if (input.sourceMaintenanceCaseId && !maintenance) throw new TRPCError({ code: "NOT_FOUND", message: "حالة الصيانة المصدر غير موجودة." });
        const sourcePartId = asset?.partId ?? maintenance?.partId ?? null;
        const sourceCheck = validateDisassemblySource({ sourceSerialStatus: asset?.status, maintenanceDisposition: maintenance?.disposition, hasSourcePart: Boolean(sourcePartId) });
        if (!sourceCheck.ok) throw new TRPCError({ code: "CONFLICT", message: sourceCheck.reason });
        if (input.lines.some(line => line.recoveredPartId === sourcePartId)) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إعادة الصنف المصدر نفسه كقطعة مستردة." });
        const recoveredParts = await tx.select({ id: parts.id }).from(parts).where(inArray(parts.id, input.lines.map(line => line.recoveredPartId)));
        if (recoveredParts.length !== input.lines.length) throw new TRPCError({ code: "BAD_REQUEST", message: "تحتوي بنود التشليح على صنف غير موجود." });
        const now = new Date();
        const inserted = await tx.insert(disassemblyOrders).values({ disassemblyNumber: disassemblyNumberDraft(), sourcePartId, sourceSerialAssetId: asset?.id ?? null, sourceMaintenanceCaseId: maintenance?.id ?? null, reason: input.reason, notes: optionalText(input.notes), createdById: ctx.user.id, createdAt: now }).$returningId();
        const id = inserted[0]?.id;
        if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء سجل التشليح." });
        const disassemblyNumber = `RT-DS-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${String(id).padStart(5, "0")}`;
        await tx.update(disassemblyOrders).set({ disassemblyNumber }).where(eq(disassemblyOrders.id, id));
        await tx.insert(disassemblyLines).values(input.lines.map(line => ({ disassemblyOrderId: id, recoveredPartId: line.recoveredPartId, quantityRecovered: line.quantityRecovered, condition: line.condition, inspectionNote: optionalText(line.inspectionNote) })));
        return { id, disassemblyNumber } as const;
      });
    }),
    submit: warehousePermissionProcedure("manage_disassembly").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb(); const [order] = await db.select().from(disassemblyOrders).where(eq(disassemblyOrders.id, input.id)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "سجل التشليح غير موجود." }); if (order.status !== "draft") throw new TRPCError({ code: "CONFLICT", message: "يمكن إرسال مسودة تشليح فقط." });
      await db.update(disassemblyOrders).set({ status: "submitted" }).where(eq(disassemblyOrders.id, order.id)); return { success: true } as const;
    }),
    approve: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb(); const [order] = await db.select().from(disassemblyOrders).where(eq(disassemblyOrders.id, input.id)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "سجل التشليح غير موجود." }); if (order.status !== "submitted") throw new TRPCError({ code: "CONFLICT", message: "يمكن اعتماد تشليح مُرسل فقط." });
      await db.update(disassemblyOrders).set({ status: "approved", approvedById: ctx.user.id, approvedAt: new Date() }).where(eq(disassemblyOrders.id, order.id)); return { success: true } as const;
    }),
    complete: warehousePermissionProcedure("manage_disassembly").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [order] = await tx.select().from(disassemblyOrders).where(eq(disassemblyOrders.id, input.id)).limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "سجل التشليح غير موجود." });
        const rows = await tx.select({ line: disassemblyLines, recoveredPart: parts }).from(disassemblyLines).innerJoin(parts, eq(disassemblyLines.recoveredPartId, parts.id)).where(eq(disassemblyLines.disassemblyOrderId, order.id));
        const plan = prepareDisassemblyCompletion({ status: order.status, sourceSerialAssetId: order.sourceSerialAssetId, lines: rows.map(row => ({ ...row.line, recoveredPart: row.recoveredPart })), disassemblyOrderId: order.id, disassemblyNumber: order.disassemblyNumber, actorId: ctx.user.id });
        if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
        for (const recovery of plan.recovered) { const row = rows.find(item => item.line.id === recovery.lineId)!; if (recovery.quantityRestocked) await tx.update(parts).set({ quantity: recovery.quantityAfter }).where(eq(parts.id, row.recoveredPart.id)); await tx.update(disassemblyLines).set({ quantityRestocked: recovery.quantityRestocked }).where(eq(disassemblyLines.id, recovery.lineId)); if (recovery.transaction) await tx.insert(inventoryTransactions).values(recovery.transaction as any); }
        if (order.sourceSerialAssetId) { const [asset] = await tx.select().from(serialAssets).where(eq(serialAssets.id, order.sourceSerialAssetId)).limit(1); if (!asset || !["in_maintenance", "retired", "scrapped"].includes(asset.status)) throw new TRPCError({ code: "CONFLICT", message: "تغيرت حالة المصدر التسلسلي ولا يمكن إكمال التشليح." }); await tx.update(serialAssets).set({ status: "cannibalized", currentHolderId: null }).where(eq(serialAssets.id, asset.id)); await tx.insert(serialAssetEvents).values({ serialAssetId: asset.id, type: "disassembled", fromStatus: asset.status, toStatus: "cannibalized", actorId: ctx.user.id, note: `إكمال التشليح ${order.disassemblyNumber}.` }); }
        await tx.update(disassemblyOrders).set({ status: "completed", completedById: ctx.user.id, completedAt: plan.completedAt }).where(eq(disassemblyOrders.id, order.id));
        await tx.insert(warehouseActivities).values({ type: "disassembly_completed", actorId: ctx.user.id, title: "إكمال تشليح", detail: `تم إكمال ${order.disassemblyNumber} مع إعادة ${plan.recovered.filter(item => item.quantityRestocked).length} بند صالح فقط.`, disassemblyOrderId: order.id, partId: order.sourcePartId });
        await tx.insert(warehouseAlerts).values({ type: "disassembly_completed", title: "اكتمل تشليح منتج أو جهاز", body: `اكتمل ${order.disassemblyNumber} وسجلت القطع القابلة لإعادة الاستخدام فقط.`, disassemblyOrderId: order.id, dedupeKey: `disassembly-complete:${order.id}` });
        return { success: true, restockedLines: plan.recovered.filter(item => item.quantityRestocked).length } as const;
      });
    }),
  }),
});
