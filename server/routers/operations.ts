import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import {
  assemblyOrderLines,
  assemblyOrders,
  dispensingRequests,
  handoverInvoices,
  maintenanceCaseTypeValues,
  maintenanceCases,
  companies,
  parts,
  purchaseOrderLines,
  purchaseOrders,
  productComponents,
  users,
  warehouseActivities,
  warehouseAlerts,
  inventoryTransactions,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, router, warehousePermissionProcedure } from "../_core/trpc";
import { buildOperationalEscalations, prepareMaintenanceDispatch, prepareMaintenanceReceipt, prepareMaintenanceResolution } from "../warehouseOperations";
import { preparePurchaseReceipt } from "../warehousePurchasing";
import { prepareAssemblyCompletion } from "../warehouseAssembly";
import { runOperationalEscalationSweep } from "../warehouseEscalations";
import { z } from "zod";

const maintenanceCreateInput = z.object({
  type: z.enum(maintenanceCaseTypeValues),
  partId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  customerName: z.string().trim().max(200).optional(),
  customerReference: z.string().trim().max(160).optional(),
  assetSerialNumber: z.string().trim().max(160).optional(),
  externalServiceProvider: z.string().trim().max(200).optional(),
  externalReference: z.string().trim().max(160).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  outboundCondition: z.string().trim().max(2000).optional(),
  estimatedCost: z.number().int().min(0).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const maintenanceProgressInput = z.object({
  id: z.number().int().positive(),
  status: z.enum(["under_diagnosis", "repair_in_progress", "quality_check"]),
  diagnosis: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const maintenanceResolveInput = z.object({
  id: z.number().int().positive(),
  disposition: z.enum(["return_to_stock", "return_to_customer", "cannibalize", "scrap"]),
  inboundCondition: z.string().trim().max(2000).optional(),
  diagnosis: z.string().trim().max(2000).optional(),
  resolutionNote: z.string().trim().max(2000).optional(),
  actualCost: z.number().int().min(0).optional(),
});

const purchaseOrderCreateInput = z.object({
  supplierCompanyId: z.number().int().positive(),
  expectedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(2000).optional(),
  lines: z.array(z.object({ partId: z.number().int().positive(), quantityOrdered: z.number().int().positive(), notes: z.string().trim().max(1000).optional() })).min(1).max(100),
});

function optionalText(value?: string) {
  return value?.trim() ? value.trim() : null;
}

function makeCaseDraftNumber() {
  return `TMP-MNT-${nanoid(12).toUpperCase()}`;
}

function makePurchaseDraftNumber() {
  return `TMP-PO-${nanoid(12).toUpperCase()}`;
}

function makeAssemblyDraftNumber() {
  return `TMP-ASM-${nanoid(12).toUpperCase()}`;
}

function labelCaseType(type: "maintenance_outbound" | "customer_return") {
  return type === "maintenance_outbound" ? "صيانة خارجية" : "مرتجع من عميل";
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "بيانات العمليات غير متاحة مؤقتًا." });
  return db;
}

export const operationsRouter = router({
  maintenance: router({
    list: warehousePermissionProcedure("manage_maintenance").query(async () => {
      const db = await requireDb();
      return db
        .select({ maintenanceCase: maintenanceCases, part: parts, createdBy: { id: users.id, name: users.name } })
        .from(maintenanceCases)
        .innerJoin(parts, eq(maintenanceCases.partId, parts.id))
        .leftJoin(users, eq(maintenanceCases.createdById, users.id))
        .orderBy(desc(maintenanceCases.createdAt));
    }),

    create: warehousePermissionProcedure("manage_maintenance").input(maintenanceCreateInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [part] = await tx.select().from(parts).where(eq(parts.id, input.partId)).limit(1);
        if (!part) throw new TRPCError({ code: "NOT_FOUND", message: "القطعة المحددة غير موجودة." });
        if (input.type === "maintenance_outbound" && input.quantity > part.quantity - part.reservedQuantity) {
          throw new TRPCError({ code: "CONFLICT", message: `الكمية المتاحة للصيانة هي ${part.quantity - part.reservedQuantity} فقط.` });
        }
        const createdAt = new Date();
        const ids = await tx.insert(maintenanceCases).values({
          caseNumber: makeCaseDraftNumber(),
          type: input.type,
          status: input.type === "customer_return" ? "awaiting_inspection" : "open",
          partId: part.id,
          quantity: input.quantity,
          customerName: optionalText(input.customerName),
          customerReference: optionalText(input.customerReference),
          assetSerialNumber: optionalText(input.assetSerialNumber),
          externalServiceProvider: optionalText(input.externalServiceProvider),
          externalReference: optionalText(input.externalReference),
          priority: input.priority,
          outboundCondition: optionalText(input.outboundCondition),
          estimatedCost: input.estimatedCost ?? null,
          notes: optionalText(input.notes),
          createdById: ctx.user.id,
          createdAt,
        }).$returningId();
        const id = ids[0]?.id;
        if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر فتح حالة العملية." });
        const caseNumber = `RT-MNT-${createdAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(id).padStart(5, "0")}`;
        await tx.update(maintenanceCases).set({ caseNumber }).where(eq(maintenanceCases.id, id));
        await tx.insert(warehouseActivities).values({
          type: input.type === "maintenance_outbound" ? "maintenance_dispatched" : "maintenance_returned",
          actorId: ctx.user.id,
          title: input.type === "maintenance_outbound" ? "فتح حالة صيانة" : "تسجيل مرتجع من عميل",
          detail: `${labelCaseType(input.type)}: ${input.quantity} × ${part.name} تحت الرقم ${caseNumber}.`,
          partId: part.id,
          maintenanceCaseId: id,
        });
        return { id, caseNumber } as const;
      });
    }),

    progress: warehousePermissionProcedure("manage_maintenance").input(maintenanceProgressInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [record] = await db.select().from(maintenanceCases).where(eq(maintenanceCases.id, input.id)).limit(1);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "حالة الصيانة أو المرتجع غير موجودة." });
      if (["returned_to_stock", "closed", "cancelled"].includes(record.status)) throw new TRPCError({ code: "CONFLICT", message: "لا يمكن تحديث حالة منتهية أو ملغاة." });
      if (record.type === "maintenance_outbound" && record.status === "open") throw new TRPCError({ code: "CONFLICT", message: "يجب إخراج القطعة للصيانة أولًا قبل تسجيل التشخيص." });
      await db.update(maintenanceCases).set({
        status: input.status,
        diagnosis: optionalText(input.diagnosis) ?? record.diagnosis,
        notes: optionalText(input.notes) ?? record.notes,
      }).where(eq(maintenanceCases.id, record.id));
      await db.insert(warehouseActivities).values({
        type: "maintenance_resolved",
        actorId: ctx.user.id,
        title: "تحديث حالة الصيانة",
        detail: `تم تحديث الحالة ${record.caseNumber} إلى ${input.status}.`,
        partId: record.partId,
        maintenanceCaseId: record.id,
      });
      return { success: true } as const;
    }),

    resolve: warehousePermissionProcedure("manage_maintenance").input(maintenanceResolveInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [record] = await tx
          .select({ maintenanceCase: maintenanceCases, part: parts })
          .from(maintenanceCases)
          .innerJoin(parts, eq(maintenanceCases.partId, parts.id))
          .where(eq(maintenanceCases.id, input.id))
          .limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "حالة الصيانة أو المرتجع غير موجودة." });
        const plan = prepareMaintenanceResolution(record, ctx.user.id, input.disposition);
        if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
        if (plan.returnsToStock) await tx.update(parts).set({ quantity: plan.quantityAfter }).where(eq(parts.id, record.part.id));
        await tx.update(maintenanceCases).set({
          status: plan.nextStatus,
          receivedById: plan.returnsToStock ? ctx.user.id : record.maintenanceCase.receivedById,
          returnedAt: plan.returnsToStock ? plan.resolvedAt : record.maintenanceCase.returnedAt,
          resolvedAt: plan.resolvedAt,
          inboundCondition: optionalText(input.inboundCondition) ?? record.maintenanceCase.inboundCondition,
          diagnosis: optionalText(input.diagnosis) ?? record.maintenanceCase.diagnosis,
          resolutionNote: optionalText(input.resolutionNote),
          disposition: input.disposition,
          actualCost: input.actualCost ?? record.maintenanceCase.actualCost,
        }).where(eq(maintenanceCases.id, record.maintenanceCase.id));
        if (plan.transaction) await tx.insert(inventoryTransactions).values(plan.transaction);
        await tx.insert(warehouseActivities).values({
          type: "maintenance_resolved",
          actorId: ctx.user.id,
          title: plan.returnsToStock ? "إعادة قطعة إلى المخزون" : "قرار نهائي لحالة صيانة",
          detail: plan.returnsToStock
            ? `تمت إعادة ${record.maintenanceCase.quantity} × ${record.part.name} إلى المخزون بعد الفحص.`
            : `أُغلقت الحالة ${record.maintenanceCase.caseNumber} دون إضافة رصيد، بقرار ${input.disposition}.`,
          partId: record.part.id,
          maintenanceCaseId: record.maintenanceCase.id,
        });
        if (plan.returnsToStock) await tx.insert(warehouseAlerts).values({
          type: "maintenance_returned",
          title: "إعادة قطعة من الصيانة أو العميل",
          body: `أُعيد ${record.maintenanceCase.quantity} × ${record.part.name} إلى المخزون من الحالة ${record.maintenanceCase.caseNumber}.`,
          partId: record.part.id,
          maintenanceCaseId: record.maintenanceCase.id,
          dedupeKey: `maintenance-return:${record.maintenanceCase.id}`,
        });
        return { success: true, returnedToStock: plan.returnsToStock, quantityAfter: plan.quantityAfter } as const;
      });
    }),

    dispatch: warehousePermissionProcedure("manage_maintenance").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [record] = await tx
          .select({ maintenanceCase: maintenanceCases, part: parts })
          .from(maintenanceCases)
          .innerJoin(parts, eq(maintenanceCases.partId, parts.id))
          .where(eq(maintenanceCases.id, input.id))
          .limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "حالة الصيانة غير موجودة." });
        const plan = prepareMaintenanceDispatch(record, ctx.user.id);
        if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
        await tx.update(parts).set({ quantity: plan.quantityAfter }).where(eq(parts.id, record.part.id));
        await tx.update(maintenanceCases).set({ status: "sent_for_maintenance", dispatchedById: ctx.user.id, sentAt: plan.dispatchedAt }).where(eq(maintenanceCases.id, record.maintenanceCase.id));
        await tx.insert(inventoryTransactions).values(plan.transaction);
        await tx.insert(warehouseActivities).values({
          type: "maintenance_dispatched",
          actorId: ctx.user.id,
          title: "إخراج قطعة للصيانة",
          detail: `تم إخراج ${record.maintenanceCase.quantity} × ${record.part.name} للصيانة الخارجية.`,
          partId: record.part.id,
          maintenanceCaseId: record.maintenanceCase.id,
        });
        return { success: true, quantityAfter: plan.quantityAfter } as const;
      });
    }),

    receiveToStock: warehousePermissionProcedure("manage_maintenance").input(z.object({ id: z.number().int().positive(), inboundCondition: z.string().trim().min(2).max(2000), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [record] = await tx
          .select({ maintenanceCase: maintenanceCases, part: parts })
          .from(maintenanceCases)
          .innerJoin(parts, eq(maintenanceCases.partId, parts.id))
          .where(eq(maintenanceCases.id, input.id))
          .limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "حالة الصيانة أو المرتجع غير موجودة." });
        const plan = prepareMaintenanceReceipt(record, ctx.user.id);
        if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
        await tx.update(parts).set({ quantity: plan.quantityAfter }).where(eq(parts.id, record.part.id));
        await tx.update(maintenanceCases).set({
          status: "returned_to_stock",
          receivedById: ctx.user.id,
          returnedAt: plan.returnedAt,
          inboundCondition: input.inboundCondition,
          notes: optionalText(input.notes) ?? record.maintenanceCase.notes,
        }).where(eq(maintenanceCases.id, record.maintenanceCase.id));
        await tx.insert(inventoryTransactions).values(plan.transaction);
        await tx.insert(warehouseActivities).values({
          type: "maintenance_returned",
          actorId: ctx.user.id,
          title: "إعادة قطعة إلى المخزون",
          detail: `تمت إضافة ${record.maintenanceCase.quantity} × ${record.part.name} إلى المخزون بعد الفحص.`,
          partId: record.part.id,
          maintenanceCaseId: record.maintenanceCase.id,
        });
        await tx.insert(warehouseAlerts).values({
          type: "maintenance_returned",
          title: "إعادة قطعة من الصيانة أو العميل",
          body: `أُعيد ${record.maintenanceCase.quantity} × ${record.part.name} إلى المخزون من الحالة ${record.maintenanceCase.caseNumber}.`,
          partId: record.part.id,
          maintenanceCaseId: record.maintenanceCase.id,
          dedupeKey: `maintenance-return:${record.maintenanceCase.id}`,
        });
        return { success: true, quantityAfter: plan.quantityAfter } as const;
      });
    }),

    close: warehousePermissionProcedure("manage_maintenance").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const [record] = await db.select().from(maintenanceCases).where(eq(maintenanceCases.id, input.id)).limit(1);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "حالة العملية غير موجودة." });
      if (record.status !== "returned_to_stock") throw new TRPCError({ code: "CONFLICT", message: "لا يمكن إغلاق الحالة قبل إعادة القطعة إلى المخزون." });
      await db.update(maintenanceCases).set({ status: "closed" }).where(eq(maintenanceCases.id, input.id));
      return { success: true } as const;
    }),
  }),

  purchasing: router({
    list: warehousePermissionProcedure("manage_purchasing").query(async () => {
      const db = await requireDb();
      const [orders, lines] = await Promise.all([
        db.select({ order: purchaseOrders, supplier: companies }).from(purchaseOrders).innerJoin(companies, eq(purchaseOrders.supplierCompanyId, companies.id)).orderBy(desc(purchaseOrders.createdAt)),
        db.select({ line: purchaseOrderLines, part: parts }).from(purchaseOrderLines).innerJoin(parts, eq(purchaseOrderLines.partId, parts.id)),
      ]);
      return orders.map(order => ({ ...order, lines: lines.filter(line => line.line.purchaseOrderId === order.order.id) }));
    }),

    create: warehousePermissionProcedure("manage_purchasing").input(purchaseOrderCreateInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const partIds = new Set(input.lines.map(line => line.partId));
      if (partIds.size !== input.lines.length) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تكرار القطعة في بنود أمر الشراء." });
      return db.transaction(async tx => {
        const [supplier] = await tx.select().from(companies).where(and(eq(companies.id, input.supplierCompanyId), eq(companies.isActive, 1))).limit(1);
        if (!supplier) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر شركة نشطة لاستخدامها كمورد." });
        const selectedParts = await tx.select().from(parts);
        const partsById = new Map(selectedParts.map(part => [part.id, part]));
        if (input.lines.some(line => !partsById.has(line.partId))) throw new TRPCError({ code: "BAD_REQUEST", message: "تحتوي بنود الشراء على قطعة غير موجودة." });
        const createdAt = new Date();
        const ids = await tx.insert(purchaseOrders).values({
          orderNumber: makePurchaseDraftNumber(),
          supplierCompanyId: supplier.id,
          expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
          notes: optionalText(input.notes),
          createdById: ctx.user.id,
          createdAt,
        }).$returningId();
        const id = ids[0]?.id;
        if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء أمر الشراء." });
        const orderNumber = `RT-PO-${createdAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(id).padStart(5, "0")}`;
        await tx.update(purchaseOrders).set({ orderNumber }).where(eq(purchaseOrders.id, id));
        await tx.insert(purchaseOrderLines).values(input.lines.map(line => {
          const part = partsById.get(line.partId)!;
          const available = part.quantity - part.reservedQuantity;
          const shortage = Math.max(0, part.minimumStock - available);
          return {
            purchaseOrderId: id,
            partId: part.id,
            quantityOrdered: line.quantityOrdered,
            shortageQuantitySnapshot: shortage || null,
            shortageReason: shortage ? `الرصيد المتاح (${available}) أقل من الحد الأدنى (${part.minimumStock}).` : null,
            notes: optionalText(line.notes),
          };
        }));
        await tx.insert(warehouseActivities).values({
          type: "purchase_order_created",
          actorId: ctx.user.id,
          title: "إنشاء أمر شراء",
          detail: `تم إنشاء أمر الشراء ${orderNumber} لدى المورد ${supplier.name} بعدد ${input.lines.length} بند.`,
          purchaseOrderId: id,
        });
        return { id, orderNumber } as const;
      });
    }),

    markOrdered: warehousePermissionProcedure("manage_purchasing").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "أمر الشراء غير موجود." });
      if (order.status !== "draft") throw new TRPCError({ code: "CONFLICT", message: "يمكن إرسال أمر الشراء المسود فقط." });
      const orderedAt = new Date();
      await db.update(purchaseOrders).set({ status: "ordered", orderedAt }).where(eq(purchaseOrders.id, order.id));
      return { success: true, orderedAt } as const;
    }),

    receive: warehousePermissionProcedure("manage_purchasing").input(z.object({ id: z.number().int().positive(), lines: z.array(z.object({ lineId: z.number().int().positive(), quantityReceived: z.number().int().positive() })).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [order] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "أمر الشراء غير موجود." });
        const lineRows = await tx.select({ line: purchaseOrderLines, part: parts }).from(purchaseOrderLines).innerJoin(parts, eq(purchaseOrderLines.partId, parts.id)).where(eq(purchaseOrderLines.purchaseOrderId, order.id));
        const plan = preparePurchaseReceipt({ orderStatus: order.status, lines: lineRows.map(row => ({ ...row.line, part: row.part })), receiving: input.lines, actorId: ctx.user.id });
        if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
        const now = new Date();
        for (const update of plan.updates) {
          await tx.update(purchaseOrderLines).set({ quantityReceived: update.quantityReceivedAfter }).where(eq(purchaseOrderLines.id, update.line.id));
          await tx.update(parts).set({ quantity: update.quantityAfter }).where(eq(parts.id, update.line.part.id));
          await tx.insert(inventoryTransactions).values({
            partId: update.line.part.id,
            purchaseOrderId: order.id,
            type: "purchase_received",
            quantityDelta: update.receivedNow,
            quantityBefore: update.line.part.quantity,
            quantityAfter: update.quantityAfter,
            actorId: ctx.user.id,
            partNumberSnapshot: update.line.part.partNumber,
            partNameSnapshot: update.line.part.name,
            warehouseSectionSnapshot: update.line.part.warehouseSection,
            details: `تم استلام ${update.receivedNow} وحدة ضمن أمر الشراء ${order.orderNumber}.`,
          });
        }
        await tx.update(purchaseOrders).set({ status: plan.nextStatus, receivedAt: plan.nextStatus === "received" ? now : null }).where(eq(purchaseOrders.id, order.id));
        await tx.insert(warehouseActivities).values({
          type: "purchase_received",
          actorId: ctx.user.id,
          title: "استلام أمر شراء",
          detail: `تم استلام ${plan.updates.length} بند من أمر الشراء ${order.orderNumber} بحالة ${plan.nextStatus === "received" ? "مكتمل" : "جزئي"}.`,
          purchaseOrderId: order.id,
        });
        await tx.insert(warehouseAlerts).values({
          type: "purchase_received",
          title: "تم استلام توريد مخزون",
          body: `تم تسجيل استلام من أمر الشراء ${order.orderNumber} بعدد ${plan.updates.length} بند.`,
          purchaseOrderId: order.id,
          dedupeKey: `purchase-receipt:${order.id}:${now.toISOString()}`,
        });
        return { success: true, status: plan.nextStatus } as const;
      });
    }),

    cancel: warehousePermissionProcedure("manage_purchasing").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "أمر الشراء غير موجود." });
      if (order.status === "received" || order.status === "cancelled") throw new TRPCError({ code: "CONFLICT", message: "لا يمكن إلغاء أمر شراء مكتمل أو ملغى." });
      await db.update(purchaseOrders).set({ status: "cancelled" }).where(eq(purchaseOrders.id, order.id));
      return { success: true } as const;
    }),
  }),

  assembly: router({
    list: warehousePermissionProcedure("manage_work_orders").query(async () => {
      const db = await requireDb();
      const [orders, lines] = await Promise.all([
        db.select({ order: assemblyOrders, target: parts }).from(assemblyOrders).innerJoin(parts, eq(assemblyOrders.targetProductId, parts.id)).orderBy(desc(assemblyOrders.createdAt)),
        db.select({ line: assemblyOrderLines, source: parts }).from(assemblyOrderLines).innerJoin(parts, eq(assemblyOrderLines.sourcePartId, parts.id)),
      ]);
      return orders.map(order => ({ ...order, lines: lines.filter(line => line.line.assemblyOrderId === order.order.id) }));
    }),

    createAndComplete: warehousePermissionProcedure("manage_work_orders").input(z.object({ targetProductId: z.number().int().positive(), quantityToProduce: z.number().int().positive(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [target] = await tx.select().from(parts).where(eq(parts.id, input.targetProductId)).limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "المنتج التام غير موجود." });
        const bomRows = await tx
          .select({ bom: productComponents, source: parts })
          .from(productComponents)
          .innerJoin(parts, eq(productComponents.componentId, parts.id))
          .where(eq(productComponents.productId, target.id));
        const invalidSource = bomRows.find(row => row.source.warehouseSection !== "components" && !(row.source.warehouseSection === "products" && row.source.productStage === "work_in_progress"));
        if (invalidSource) throw new TRPCError({ code: "CONFLICT", message: "تحتوي قائمة المكونات على مصدر غير صالح للتجميع." });
        const createdAt = new Date();
        const ids = await tx.insert(assemblyOrders).values({
          assemblyNumber: makeAssemblyDraftNumber(),
          targetProductId: target.id,
          quantityToProduce: input.quantityToProduce,
          notes: optionalText(input.notes),
          createdById: ctx.user.id,
          createdAt,
        }).$returningId();
        const id = ids[0]?.id;
        if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء أمر التجميع." });
        const assemblyNumber = `RT-ASM-${createdAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(id).padStart(5, "0")}`;
        await tx.update(assemblyOrders).set({ assemblyNumber }).where(eq(assemblyOrders.id, id));
        const plan = prepareAssemblyCompletion({
          target,
          bom: bomRows.map(row => ({ componentId: row.bom.componentId, quantityRequired: row.bom.quantityRequired, source: row.source })),
          quantityToProduce: input.quantityToProduce,
          actorId: ctx.user.id,
          assemblyOrderId: id,
          assemblyNumber,
        });
        if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
        for (const source of plan.consumed) {
          await tx.update(parts).set({ quantity: source.quantityAfter }).where(eq(parts.id, source.source.id));
        }
        await tx.update(parts).set({ quantity: plan.targetQuantityAfter }).where(eq(parts.id, target.id));
        await tx.update(assemblyOrders).set({ status: "completed", completedById: ctx.user.id, completedAt: plan.completedAt }).where(eq(assemblyOrders.id, id));
        await tx.insert(assemblyOrderLines).values(plan.consumed.map(source => ({
          assemblyOrderId: id,
          sourcePartId: source.source.id,
          quantityPerUnit: source.quantityRequired,
          quantityConsumed: source.quantityConsumed,
          partNumberSnapshot: source.source.partNumber,
          partNameSnapshot: source.source.name,
        })));
        await tx.insert(inventoryTransactions).values([...plan.sourceTransactions, plan.targetTransaction]);
        await tx.insert(warehouseActivities).values({
          type: "assembly_completed",
          actorId: ctx.user.id,
          title: "إكمال أمر تجميع",
          detail: `تم إنتاج ${input.quantityToProduce} × ${target.name} عبر الأمر ${assemblyNumber} مع توثيق ${plan.consumed.length} مصدر.`,
          partId: target.id,
          assemblyOrderId: id,
        });
        await tx.insert(warehouseAlerts).values({
          type: "assembly_completed",
          title: "تم تحويل مكونات إلى منتج تام",
          body: `أنتج أمر التجميع ${assemblyNumber} عدد ${input.quantityToProduce} × ${target.name}.`,
          partId: target.id,
          assemblyOrderId: id,
          dedupeKey: `assembly-complete:${id}`,
        });
        return { id, assemblyNumber, quantityAfter: plan.targetQuantityAfter } as const;
      });
    }),
  }),

  escalations: router({
    run: adminProcedure.mutation(async () => {
      return runOperationalEscalationSweep();
    }),
  }),
});
