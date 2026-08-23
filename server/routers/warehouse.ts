import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  dispensingRequests,
  custodyAssignments,
  handoverInvoices,
  warehouseSectionValues,
  productStageValues,
  serialTrackingModeValues,
  parts,
  inventoryCategories,
  inventoryTransactions,
  users,
  warehouseAlerts,
  warehouseActivities,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { executeConfirmedDelivery } from "../warehouseDelivery";
import { availableInsideWarehouse, validateCustodyIssue, validateCustodyReturn } from "../warehouseCustody";
import { buildDecisionNotification, buildHandoverNotification } from "../warehouseNotifications";
import { canDecideRequest, canEngineerSubmit, isLowStock, mustScopeRequestsToRequester } from "../warehouseRules";
import { makePartBarcode, normalizeWarehouseBarcode } from "../warehouseTraceability";
import { z } from "zod";

const partInput = z.object({
  partNumber: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.number().int().positive().nullable(),
  warehouseSection: z.enum(warehouseSectionValues).default("components"),
  componentTypeId: z.number().int().positive().nullable().optional(),
  companyId: z.number().int().positive().nullable().optional(),
  productStage: z.enum(productStageValues).nullable().optional(),
  quantity: z.number().int().min(0),
  minimumStock: z.number().int().min(0),
  location: z.string().trim().max(160).optional(),
  storageShelf: z.string().trim().max(80).optional(),
  storageDrawer: z.string().trim().max(80).optional(),
  storageBox: z.string().trim().max(80).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  specifications: z.string().trim().max(4000).optional(),
  barcode: z.string().trim().max(100).optional(),
  serialTrackingMode: z.enum(serialTrackingModeValues).optional(),
});

const requestInput = z.object({
  partId: z.number().int().positive(),
  requestedQuantity: z.number().int().positive(),
  purpose: z.string().trim().min(3).max(2000),
  fulfillmentType: z.enum(["dispense", "custody"]).default("dispense"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  projectReference: z.string().trim().max(160).optional(),
  requestNote: z.string().trim().max(2000).optional(),
});

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "بيانات المخزن غير متاحة مؤقتًا.",
    });
  }
  return db;
}

function optionalText(value?: string) {
  return value?.trim() ? value.trim() : null;
}

function warehouseSectionLabel(section: "components" | "products") {
  return section === "products" ? "المنتجات" : "المكونات";
}

function canDispensePart(part: { warehouseSection: "components" | "products"; productStage: (typeof productStageValues)[number] | null }) {
  return part.warehouseSection === "components" || part.productStage === "finished" || part.productStage === "final_operational";
}

function availableForIssue(part: { quantity: number; reservedQuantity: number; custodyQuantity: number }) {
  return availableInsideWarehouse(part);
}

function custodyNumberFor(requestId: number, issuedAt: Date) {
  return `RT-CUS-${issuedAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(requestId).padStart(5, "0")}`;
}

const engineerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!canEngineerSubmit(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "المهندسون والمستخدمون فقط يمكنهم إرسال طلبات الصرف." });
  }
  return next({ ctx });
});

export const warehouseRouter = router({
  inventory: router({
    list: protectedProcedure.input(z.object({ section: z.enum(warehouseSectionValues).optional() }).optional()).query(async ({ input }) => {
      const db = await requireDb();
      const query = db.select().from(parts);
      return input?.section
        ? query.where(eq(parts.warehouseSection, input.section)).orderBy(desc(parts.updatedAt))
        : query.orderBy(desc(parts.updatedAt));
    }),

    lowStock: adminProcedure.query(async () => {
      const db = await requireDb();
      const allParts = await db.select().from(parts).orderBy(desc(parts.updatedAt));
      return allParts.filter(part => availableForIssue(part) <= part.minimumStock);
    }),

    uploadImage: adminProcedure.input(z.object({ fileName: z.string().trim().min(1).max(120), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(4).max(7_000_000) })).mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.base64, "base64");
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب ألا يتجاوز حجم الصورة 5 ميغابايت." });
      const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType === "image/png" ? "png" : "webp";
      const safeName = input.fileName.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "part";
      const stored = await storagePut(`warehouse-parts/${ctx.user.id}/${safeName}.${extension}`, bytes, input.contentType);
      return { url: stored.url } as const;
    }),

    create: adminProcedure.input(partInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        return await db.transaction(async tx => {
          if (!input.categoryId) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر تصنيف مخزون نشطًا." });
          const [category] = await tx.select().from(inventoryCategories).where(and(eq(inventoryCategories.id, input.categoryId), eq(inventoryCategories.isActive, 1))).limit(1);
          if (!category) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر تصنيف مخزون نشطًا." });
          await tx.insert(parts).values({
            ...input,
            category: category.name,
            categoryId: category.id,
            description: optionalText(input.description),
            location: optionalText(input.location),
            storageShelf: optionalText(input.storageShelf),
            storageDrawer: optionalText(input.storageDrawer),
            storageBox: optionalText(input.storageBox),
            imageUrl: optionalText(input.imageUrl),
            specifications: optionalText(input.specifications),
            componentTypeId: input.warehouseSection === "components" ? input.componentTypeId ?? null : null,
            companyId: input.warehouseSection === "products" ? input.companyId ?? null : null,
            productStage: input.warehouseSection === "products" ? input.productStage ?? "finished" : null,
            barcode: input.barcode ? normalizeWarehouseBarcode(input.barcode) : null,
            serialTrackingMode: input.serialTrackingMode ?? "none",
            createdById: ctx.user.id,
          });
          let [created] = await tx
            .select()
            .from(parts)
            .where(eq(parts.partNumber, input.partNumber))
            .limit(1);

          if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر إنشاء القطعة." });
          if (!created.barcode) {
            await tx.update(parts).set({ barcode: makePartBarcode(created) }).where(eq(parts.id, created.id));
            const [withBarcode] = await tx.select().from(parts).where(eq(parts.id, created.id)).limit(1);
            if (!withBarcode) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر تجهيز باركود الصنف." });
            created = withBarcode;
          }

          await tx.insert(inventoryTransactions).values({
            partId: created.id,
            type: "part_created",
            quantityDelta: input.quantity,
            quantityBefore: 0,
            quantityAfter: input.quantity,
            actorId: ctx.user.id,
            partNumberSnapshot: created.partNumber,
            partNameSnapshot: created.name,
            warehouseSectionSnapshot: created.warehouseSection,
            details: "تمت إضافة قطعة إلى المخزون.",
          });
          await tx.insert(warehouseActivities).values({ type: "inventory_created", actorId: ctx.user.id, title: "إضافة سجل مخزون", detail: `تمت إضافة ${created.name} إلى ${warehouseSectionLabel(created.warehouseSection)}.`, partId: created.id });

          if (isLowStock(created.quantity, created.minimumStock)) {
            await tx.insert(warehouseAlerts).values({
              type: "low_stock",
              title: `${warehouseSectionLabel(created.warehouseSection)}: تنبيه مخزون منخفض`,
              body: `وصلت كمية ${created.name} في ${warehouseSectionLabel(created.warehouseSection)} إلى الحد الأدنى أو انخفضت عنه.`,
              partId: created.id,
            });
          }
          return created;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "CONFLICT", message: "توجد بالفعل قطعة بهذا الكود." });
      }
    }),

    update: adminProcedure
      .input(partInput.extend({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, ...values } = input;
        return db.transaction(async tx => {
          const [existing] = await tx.select().from(parts).where(eq(parts.id, id)).limit(1);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "القطعة غير موجودة." });
          if (values.quantity < existing.reservedQuantity + existing.custodyQuantity) {
            throw new TRPCError({ code: "CONFLICT", message: `لا يمكن خفض الكمية الفعلية إلى أقل من المحجوز والعُهدة القائمة (${existing.reservedQuantity + existing.custodyQuantity}).` });
          }
          if (existing.partNumber !== values.partNumber) {
            const [duplicate] = await tx.select({ id: parts.id }).from(parts).where(eq(parts.partNumber, values.partNumber)).limit(1);
            if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "توجد بالفعل قطعة بهذا الكود." });
          }
          if (!values.categoryId) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر تصنيف مخزون نشطًا." });
          const [category] = await tx.select().from(inventoryCategories).where(and(eq(inventoryCategories.id, values.categoryId), eq(inventoryCategories.isActive, 1))).limit(1);
          if (!category) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر تصنيف مخزون نشطًا." });

          await tx
            .update(parts)
            .set({
              ...values,
              category: category.name,
              categoryId: category.id,
              description: optionalText(values.description),
              location: optionalText(values.location),
              storageShelf: optionalText(values.storageShelf),
              storageDrawer: optionalText(values.storageDrawer),
              storageBox: optionalText(values.storageBox),
              imageUrl: optionalText(values.imageUrl),
              specifications: optionalText(values.specifications),
              componentTypeId: values.warehouseSection === "components" ? values.componentTypeId ?? null : null,
              companyId: values.warehouseSection === "products" ? values.companyId ?? null : null,
              productStage: values.warehouseSection === "products" ? values.productStage ?? "finished" : null,
              barcode: values.barcode ? normalizeWarehouseBarcode(values.barcode) : existing.barcode,
              serialTrackingMode: values.serialTrackingMode ?? existing.serialTrackingMode,
            })
            .where(eq(parts.id, id));
          const [updated] = await tx.select().from(parts).where(eq(parts.id, id)).limit(1);
          if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر تحديث القطعة." });

          await tx.insert(inventoryTransactions).values({
            partId: updated.id,
            type: "part_updated",
            quantityDelta: updated.quantity - existing.quantity,
            quantityBefore: existing.quantity,
            quantityAfter: updated.quantity,
            actorId: ctx.user.id,
            partNumberSnapshot: updated.partNumber,
            partNameSnapshot: updated.name,
            warehouseSectionSnapshot: updated.warehouseSection,
            details: "تم تحديث سجل القطعة بواسطة أدمن المخزن.",
          });
          await tx.insert(warehouseActivities).values({ type: "inventory_updated", actorId: ctx.user.id, title: "تحديث سجل مخزون", detail: `تم تحديث ${updated.name} في ${warehouseSectionLabel(updated.warehouseSection)}.`, partId: updated.id });

          if (isLowStock(availableForIssue(updated), updated.minimumStock)) {
            const [existingAlert] = await tx
              .select({ id: warehouseAlerts.id })
              .from(warehouseAlerts)
              .where(and(eq(warehouseAlerts.type, "low_stock"), eq(warehouseAlerts.partId, updated.id), eq(warehouseAlerts.isRead, 0)))
              .limit(1);
            if (!existingAlert) {
              await tx.insert(warehouseAlerts).values({
                type: "low_stock",
                title: `${warehouseSectionLabel(updated.warehouseSection)}: تنبيه مخزون منخفض`,
                body: `وصلت كمية ${updated.name} في ${warehouseSectionLabel(updated.warehouseSection)} إلى الحد الأدنى أو انخفضت عنه.`,
                partId: updated.id,
              });
            }
          }
          return updated;
        });
      }),

    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const [existing] = await db.select().from(parts).where(eq(parts.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "القطعة غير موجودة." });
      const [request] = await db.select({ id: dispensingRequests.id }).from(dispensingRequests).where(eq(dispensingRequests.partId, input.id)).limit(1);
      const [custody] = await db.select({ id: custodyAssignments.id }).from(custodyAssignments).where(eq(custodyAssignments.partId, input.id)).limit(1);
      const [transaction] = await db.select({ id: inventoryTransactions.id }).from(inventoryTransactions).where(eq(inventoryTransactions.partId, input.id)).limit(1);
      if (request || custody || transaction) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "لا يمكن حذف القطع ذات الطلبات أو الحركات المسجلة، حفاظًا على سجل التدقيق.",
        });
      }
      await db.delete(parts).where(eq(parts.id, input.id));
      return { success: true } as const;
    }),
  }),

  requests: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const baseQuery = db
        .select({
          request: dispensingRequests,
          part: parts,
          engineer: { id: users.id, name: users.name, email: users.email },
        })
        .from(dispensingRequests)
        .innerJoin(parts, eq(dispensingRequests.partId, parts.id))
        .innerJoin(users, eq(dispensingRequests.requestedById, users.id));

      return mustScopeRequestsToRequester(ctx.user.role)
        ? baseQuery.where(eq(dispensingRequests.requestedById, ctx.user.id)).orderBy(desc(dispensingRequests.createdAt))
        : baseQuery.orderBy(desc(dispensingRequests.createdAt));
    }),

    create: engineerProcedure.input(requestInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const result = await db.transaction(async tx => {
        const [part] = await tx.select().from(parts).where(eq(parts.id, input.partId)).limit(1);
        if (!part) throw new TRPCError({ code: "NOT_FOUND", message: "القطعة المطلوبة لم تعد موجودة." });
        if (!canDispensePart(part)) throw new TRPCError({ code: "CONFLICT", message: "هذا المنتج غير متاح للصرف حاليًا لأنه تحت التشغيل أو المراجعة أو الصيانة." });
        const availableQuantity = availableForIssue(part);
        if (availableQuantity < input.requestedQuantity) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "الكمية المطلوبة تتجاوز المخزون المتاح." });
        }

        const insertedIds = await tx
          .insert(dispensingRequests)
          .values({
            partId: part.id,
            requestedById: ctx.user.id,
            requestedQuantity: input.requestedQuantity,
            purpose: input.purpose,
            fulfillmentType: input.fulfillmentType,
            custodyDueAt: input.fulfillmentType === "custody" && input.dueDate ? new Date(`${input.dueDate}T23:59:59.999Z`) : null,
            recipientName: ctx.user.name || "الموظف المسجل",
            recipientDepartment: null,
            projectReference: optionalText(input.projectReference),
            requestNote: optionalText(input.requestNote),
          })
          .$returningId();
        const requestId = insertedIds[0]?.id;
        if (!requestId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر إنشاء طلب الصرف." });

        await tx.insert(inventoryTransactions).values({
          partId: part.id,
          requestId,
          type: "request_submitted",
          quantityDelta: 0,
          quantityBefore: part.quantity,
          quantityAfter: part.quantity,
          actorId: ctx.user.id,
          engineerId: ctx.user.id,
          partNumberSnapshot: part.partNumber,
          partNameSnapshot: part.name,
          warehouseSectionSnapshot: part.warehouseSection,
          details: `تم طلب ${input.requestedQuantity} وحدة ${input.fulfillmentType === "custody" ? "كعُهدة" : "للصرف"} بواسطة ${ctx.user.name || "الموظف المسجل"}. الغرض: ${input.purpose}`,
        });
        await tx.insert(warehouseAlerts).values({
          type: "new_request",
          title: `${warehouseSectionLabel(part.warehouseSection)}: طلب ${input.fulfillmentType === "custody" ? "عُهدة" : "صرف"} جديد`,
          body: `طلب ${ctx.user.name || "مهندس"} ${input.requestedQuantity} × ${part.name} ${input.fulfillmentType === "custody" ? "كعُهدة" : "للصرف"}.`,
          partId: part.id,
          requestId,
        });
        await tx.insert(warehouseActivities).values({ type: "request_submitted", actorId: ctx.user.id, title: input.fulfillmentType === "custody" ? "إرسال طلب عُهدة" : "إرسال طلب صرف", detail: `تم طلب ${input.requestedQuantity} × ${part.name} ${input.fulfillmentType === "custody" ? "كعُهدة" : "للصرف"}.`, requestId, partId: part.id });
        return { requestId, partName: part.name, fulfillmentType: input.fulfillmentType };
      });

      const notificationSent = await notifyOwner({
        title: "طلب صرف جديد من المخزن",
        content: `طلب ${ctx.user.name || "مهندس"} ${input.requestedQuantity} × ${result.partName} ${result.fulfillmentType === "custody" ? "كعُهدة" : "للصرف"}.`,
      });
      return { ...result, notificationSent };
    }),

    decide: adminProcedure
      .input(z.object({ id: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), decisionNote: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        return db.transaction(async tx => {
          const [record] = await tx
            .select({ request: dispensingRequests, part: parts })
            .from(dispensingRequests)
            .innerJoin(parts, eq(dispensingRequests.partId, parts.id))
            .where(eq(dispensingRequests.id, input.id))
            .limit(1);
          if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الصرف غير موجود." });
          if (!canDecideRequest(record.request.status)) {
            throw new TRPCError({ code: "CONFLICT", message: "يمكن اعتماد أو رفض الطلبات المنتظرة فقط." });
          }
          if (input.decision === "approved" && !canDispensePart(record.part)) {
            throw new TRPCError({ code: "CONFLICT", message: "لا يمكن اعتماد صرف منتج قيد التشغيل أو المراجعة أو الصيانة." });
          }
          const availableQuantity = availableForIssue(record.part);
          if (input.decision === "approved" && record.request.requestedQuantity > availableQuantity) {
            throw new TRPCError({ code: "CONFLICT", message: `الكمية المتاحة للحجز هي ${availableQuantity} فقط، بينما الطلب يحتاج ${record.request.requestedQuantity}.` });
          }

          await tx
            .update(dispensingRequests)
            .set({ status: input.decision, decisionNote: optionalText(input.decisionNote), reviewedById: ctx.user.id, reviewedAt: new Date() })
            .where(eq(dispensingRequests.id, input.id));
          if (input.decision === "approved" && record.request.fulfillmentType === "dispense") {
            await tx.update(parts).set({ reservedQuantity: record.part.reservedQuantity + record.request.requestedQuantity }).where(eq(parts.id, record.part.id));
          }
          await tx.insert(inventoryTransactions).values({
            partId: record.part.id,
            requestId: record.request.id,
            type: input.decision === "approved" ? "request_approved" : "request_rejected",
            quantityDelta: 0,
            quantityBefore: record.part.quantity,
            quantityAfter: record.part.quantity,
            actorId: ctx.user.id,
            engineerId: record.request.requestedById,
            partNumberSnapshot: record.part.partNumber,
            partNameSnapshot: record.part.name,
            warehouseSectionSnapshot: record.part.warehouseSection,
            details: input.decision === "approved" ? record.request.fulfillmentType === "custody" ? `تم اعتماد طلب عُهدة لعدد ${record.request.requestedQuantity} وحدة بانتظار تسجيل الحائز.` : `تم اعتماد الطلب وحجز ${record.request.requestedQuantity} وحدة بانتظار التسليم الفعلي.` : `تم رفض الطلب.${input.decisionNote ? ` السبب: ${input.decisionNote}` : ""}`,
          });
          await tx.insert(warehouseActivities).values({ type: input.decision === "approved" ? "request_approved" : "request_rejected", actorId: ctx.user.id, title: input.decision === "approved" ? record.request.fulfillmentType === "custody" ? "اعتماد طلب عُهدة" : "اعتماد طلب صرف" : "رفض الطلب", detail: `تم ${input.decision === "approved" ? "اعتماد" : "رفض"} طلب ${record.part.name}.`, requestId: record.request.id, partId: record.part.id });
          await tx.insert(warehouseAlerts).values(buildDecisionNotification({ decision: input.decision, decisionNote: input.decisionNote, partId: record.part.id, partName: record.part.name, requestId: record.request.id, recipientUserId: record.request.requestedById }));
          return { success: true, status: input.decision, reservedQuantity: input.decision === "approved" && record.request.fulfillmentType === "dispense" ? record.part.reservedQuantity + record.request.requestedQuantity : record.part.reservedQuantity, availableQuantity: input.decision === "approved" && record.request.fulfillmentType === "dispense" ? availableQuantity - record.request.requestedQuantity : availableQuantity } as const;
        });
      }),

    confirmDelivery: adminProcedure.input(z.object({ id: z.number().int().positive(), deliveryNote: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [record] = await tx
          .select({
            request: dispensingRequests,
            part: parts,
            engineer: { id: users.id, name: users.name },
          })
          .from(dispensingRequests)
          .innerJoin(parts, eq(dispensingRequests.partId, parts.id))
          .innerJoin(users, eq(dispensingRequests.requestedById, users.id))
          .where(eq(dispensingRequests.id, input.id))
          .limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الصرف غير موجود." });
        if (record.request.fulfillmentType === "custody") {
          const custodyIssue = validateCustodyIssue(record.request.status, record.part, record.request.requestedQuantity);
          if (!custodyIssue.ok) throw new TRPCError({ code: "CONFLICT", message: custodyIssue.reason });
          const [existingCustody] = await tx.select({ id: custodyAssignments.id }).from(custodyAssignments).where(eq(custodyAssignments.requestId, record.request.id)).limit(1);
          if (existingCustody) throw new TRPCError({ code: "CONFLICT", message: "تم تسجيل هذه العُهدة بالفعل." });
          const issuedAt = new Date();
          const custodyNumber = custodyNumberFor(record.request.id, issuedAt);
          const insertedIds = await tx.insert(custodyAssignments).values({
            custodyNumber,
            requestId: record.request.id,
            partId: record.part.id,
            holderId: record.request.requestedById,
            issuedById: ctx.user.id,
            quantity: record.request.requestedQuantity,
            purpose: record.request.purpose,
            dueAt: record.request.custodyDueAt,
            status: "active",
            issuedAt,
            issueNote: optionalText(input.deliveryNote),
            partNumberSnapshot: record.part.partNumber,
            partNameSnapshot: record.part.name,
            warehouseSectionSnapshot: record.part.warehouseSection,
          }).$returningId();
          const custodyId = insertedIds[0]?.id;
          if (!custodyId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر تسجيل العُهدة." });
          await tx.update(parts).set({ custodyQuantity: custodyIssue.custodyQuantityAfter }).where(eq(parts.id, record.part.id));
          await tx.update(dispensingRequests).set({ status: "delivered", deliveredById: ctx.user.id, deliveredAt: issuedAt }).where(eq(dispensingRequests.id, record.request.id));
          await tx.insert(inventoryTransactions).values({ partId: record.part.id, requestId: record.request.id, custodyAssignmentId: custodyId, type: "custody_issued", quantityDelta: 0, quantityBefore: record.part.quantity, quantityAfter: record.part.quantity, actorId: ctx.user.id, engineerId: record.request.requestedById, partNumberSnapshot: record.part.partNumber, partNameSnapshot: record.part.name, warehouseSectionSnapshot: record.part.warehouseSection, details: `تم تسجيل ${record.request.requestedQuantity} وحدة كعُهدة رقم ${custodyNumber} مع ${record.engineer.name || "الموظف"} دون خصم الرصيد الفعلي.` });
          await tx.insert(warehouseActivities).values({ type: "custody_issued", actorId: ctx.user.id, title: "تسليم عُهدة", detail: `سُجلت ${record.request.requestedQuantity} × ${record.part.name} كعُهدة مع ${record.engineer.name || "الموظف"}.`, requestId: record.request.id, custodyAssignmentId: custodyId, partId: record.part.id });
          await tx.insert(warehouseAlerts).values({ type: "handover_completed", title: "تم تسجيل عُهدة", body: `سُجلت ${record.request.requestedQuantity} × ${record.part.name} بعهدتك تحت الرقم ${custodyNumber}.`, partId: record.part.id, requestId: record.request.id, recipientUserId: record.request.requestedById });
          return { success: true, fulfillmentType: "custody" as const, quantityAfter: record.part.quantity, custodyNumber };
        }
        const deliveryMovement = await executeConfirmedDelivery(record, ctx.user.id, {
          updatePartInventory: async (partId, inventory) => {
            await tx.update(parts).set(inventory).where(eq(parts.id, partId));
          },
          markRequestDelivered: async (requestId, adminId, deliveredAt) => {
            await tx
              .update(dispensingRequests)
              .set({ status: "delivered", deliveredById: adminId, deliveredAt })
              .where(eq(dispensingRequests.id, requestId));
          },
          insertTransaction: async transaction => {
            await tx.insert(inventoryTransactions).values(transaction);
          },
          createHandoverInvoice: async invoice => {
            await tx.insert(handoverInvoices).values(invoice);
          },
          recordActivity: async activity => {
            await tx.insert(warehouseActivities).values(activity);
          },
          hasUnreadLowStockAlert: async partId => {
            const [existingAlert] = await tx
              .select({ id: warehouseAlerts.id })
              .from(warehouseAlerts)
              .where(and(eq(warehouseAlerts.type, "low_stock"), eq(warehouseAlerts.partId, partId), eq(warehouseAlerts.isRead, 0)))
              .limit(1);
            return Boolean(existingAlert);
          },
          createLowStockAlert: async alert => {
            await tx.insert(warehouseAlerts).values(alert);
          },
        }, new Date(), optionalText(input.deliveryNote));
        if (!deliveryMovement.ok) {
          throw new TRPCError({ code: "CONFLICT", message: deliveryMovement.reason });
        }
        await tx.insert(warehouseAlerts).values(buildHandoverNotification({ partId: record.part.id, partName: record.part.name, requestId: record.request.id, recipientUserId: record.request.requestedById, invoiceNumber: deliveryMovement.invoice.invoiceNumber }));
        const { quantityAfter } = deliveryMovement;
        return { success: true, fulfillmentType: "dispense" as const, quantityAfter, invoiceNumber: deliveryMovement.invoice.invoiceNumber } as const;
      });
    }),
  }),

  custody: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const query = db.select({ custody: custodyAssignments, part: parts, holder: { id: users.id, name: users.name, email: users.email } })
        .from(custodyAssignments)
        .innerJoin(parts, eq(custodyAssignments.partId, parts.id))
        .innerJoin(users, eq(custodyAssignments.holderId, users.id));
      return ctx.user.role === "admin"
        ? query.orderBy(desc(custodyAssignments.issuedAt))
        : query.where(eq(custodyAssignments.holderId, ctx.user.id)).orderBy(desc(custodyAssignments.issuedAt));
    }),

    confirmReturn: adminProcedure.input(z.object({ id: z.number().int().positive(), returnNote: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [record] = await tx.select({ custody: custodyAssignments, part: parts, holder: { id: users.id, name: users.name } })
          .from(custodyAssignments)
          .innerJoin(parts, eq(custodyAssignments.partId, parts.id))
          .innerJoin(users, eq(custodyAssignments.holderId, users.id))
          .where(eq(custodyAssignments.id, input.id))
          .limit(1);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "سجل العُهدة غير موجود." });
        if (record.custody.status !== "active") throw new TRPCError({ code: "CONFLICT", message: "هذه العُهدة أُعيدت أو أُغلقت سابقًا." });
        const custodyReturn = validateCustodyReturn(record.part.custodyQuantity, record.custody.quantity);
        if (!custodyReturn.ok) throw new TRPCError({ code: "CONFLICT", message: custodyReturn.reason });
        const returnedAt = new Date();
        await tx.update(custodyAssignments).set({ status: "returned", returnedById: ctx.user.id, returnedAt, returnNote: optionalText(input.returnNote) }).where(eq(custodyAssignments.id, record.custody.id));
        await tx.update(parts).set({ custodyQuantity: custodyReturn.custodyQuantityAfter }).where(eq(parts.id, record.part.id));
        await tx.insert(inventoryTransactions).values({ partId: record.part.id, requestId: record.custody.requestId, custodyAssignmentId: record.custody.id, type: "custody_returned", quantityDelta: 0, quantityBefore: record.part.quantity, quantityAfter: record.part.quantity, actorId: ctx.user.id, engineerId: record.holder.id, partNumberSnapshot: record.part.partNumber, partNameSnapshot: record.part.name, warehouseSectionSnapshot: record.part.warehouseSection, details: `تمت إعادة ${record.custody.quantity} وحدة من العُهدة ${record.custody.custodyNumber} بواسطة ${record.holder.name || "الموظف"} دون تغيير الرصيد الفعلي.` });
        await tx.insert(warehouseActivities).values({ type: "custody_returned", actorId: ctx.user.id, title: "إعادة عُهدة", detail: `أُغلقت العُهدة ${record.custody.custodyNumber} وأعيدت ${record.custody.quantity} × ${record.part.name}.`, requestId: record.custody.requestId, custodyAssignmentId: record.custody.id, partId: record.part.id });
        return { success: true, custodyNumber: record.custody.custodyNumber } as const;
      });
    }),
  }),

  dashboard: adminProcedure.query(async () => {
    const db = await requireDb();
    const [allParts, allRequests, unreadAlerts, recentActivities, recentAccess, deliveryTransactions, recentHandovers] = await Promise.all([
      db.select().from(parts).orderBy(desc(parts.updatedAt)),
      db.select().from(dispensingRequests).orderBy(desc(dispensingRequests.createdAt)),
      db.select().from(warehouseAlerts).where(and(eq(warehouseAlerts.isRead, 0), isNull(warehouseAlerts.recipientUserId))).orderBy(desc(warehouseAlerts.createdAt)),
      db.select({ activity: warehouseActivities, actor: { id: users.id, name: users.name, email: users.email } }).from(warehouseActivities).leftJoin(users, eq(warehouseActivities.actorId, users.id)).orderBy(desc(warehouseActivities.createdAt)).limit(8),
      db.select({ id: users.id, name: users.name, email: users.email, lastSignedIn: users.lastSignedIn, role: users.role }).from(users).orderBy(desc(users.lastSignedIn)).limit(6),
      db.select().from(inventoryTransactions).where(eq(inventoryTransactions.type, "delivery_confirmed")).orderBy(desc(inventoryTransactions.createdAt)).limit(500),
      db.select({ invoice: handoverInvoices, receiver: { id: users.id, name: users.name, email: users.email } }).from(handoverInvoices).innerJoin(users, eq(handoverInvoices.receivedById, users.id)).orderBy(desc(handoverInvoices.issuedAt)).limit(6),
    ]);
    const topDispensedByPart = new Map<number, { partId: number; partName: string; partNumber: string; quantity: number }>();
    for (const transaction of deliveryTransactions) {
      const current = topDispensedByPart.get(transaction.partId) ?? { partId: transaction.partId, partName: transaction.partNameSnapshot, partNumber: transaction.partNumberSnapshot, quantity: 0 };
      current.quantity += Math.abs(transaction.quantityDelta);
      topDispensedByPart.set(transaction.partId, current);
    }
    const overdueThreshold = Date.now() - 48 * 60 * 60 * 1000;
    const overdueRequests = allRequests.filter(request => (request.status === "pending" || request.status === "approved") && request.createdAt.getTime() < overdueThreshold);
    return {
      partCount: allParts.length,
      totalUnits: allParts.reduce((sum, part) => sum + part.quantity, 0),
      reservedUnits: allParts.reduce((sum, part) => sum + part.reservedQuantity, 0),
      custodyUnits: allParts.reduce((sum, part) => sum + (part.custodyQuantity ?? 0), 0),
      availableUnits: allParts.reduce((sum, part) => sum + availableForIssue(part), 0),
      componentCount: allParts.filter(part => part.warehouseSection === "components").length,
      componentUnits: allParts.filter(part => part.warehouseSection === "components").reduce((sum, part) => sum + part.quantity, 0),
      productCount: allParts.filter(part => part.warehouseSection === "products").length,
      productUnits: allParts.filter(part => part.warehouseSection === "products").reduce((sum, part) => sum + part.quantity, 0),
      pendingRequests: allRequests.filter(request => request.status === "pending").length,
      overdueRequests,
      lowStockParts: allParts.filter(part => availableForIssue(part) <= part.minimumStock),
      topDispensedParts: Array.from(topDispensedByPart.values()).sort((left, right) => right.quantity - left.quantity).slice(0, 5),
      recentHandovers,
      unreadAlerts,
      recentActivities,
      recentAccess,
    };
  }),

  invoices: router({
    list: adminProcedure.query(async () => {
      const db = await requireDb();
      return db
        .select({ invoice: handoverInvoices, receiver: { id: users.id, name: users.name, email: users.email } })
        .from(handoverInvoices)
        .innerJoin(users, eq(handoverInvoices.receivedById, users.id))
        .orderBy(desc(handoverInvoices.issuedAt))
        .limit(100);
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db
        .select({ invoice: handoverInvoices, receiver: { id: users.id, name: users.name, email: users.email } })
        .from(handoverInvoices)
        .innerJoin(users, eq(handoverInvoices.receivedById, users.id))
        .where(eq(handoverInvoices.receivedById, ctx.user.id))
        .orderBy(desc(handoverInvoices.issuedAt))
        .limit(100);
    }),
    get: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [result] = await db
        .select({ invoice: handoverInvoices, receiver: { id: users.id, name: users.name, email: users.email } })
        .from(handoverInvoices)
        .innerJoin(users, eq(handoverInvoices.receivedById, users.id))
        .where(eq(handoverInvoices.id, input.invoiceId))
        .limit(1);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "فاتورة التسليم غير موجودة." });
      if (ctx.user.role !== "admin" && result.invoice.receivedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك الوصول إلى هذه الفاتورة." });
      return result;
    }),
    byRequest: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [result] = await db
        .select({ invoice: handoverInvoices, receiver: { id: users.id, name: users.name, email: users.email } })
        .from(handoverInvoices)
        .innerJoin(users, eq(handoverInvoices.receivedById, users.id))
        .where(eq(handoverInvoices.requestId, input.requestId))
        .limit(1);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "فاتورة التسليم غير موجودة." });
      if (ctx.user.role !== "admin" && result.invoice.receivedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك الوصول إلى هذه الفاتورة." });
      return result;
    }),
    confirmReceipt: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive(), confirmationName: z.string().trim().min(2).max(160), receiptNote: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [invoice] = await tx.select().from(handoverInvoices).where(eq(handoverInvoices.id, input.invoiceId)).limit(1);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "فاتورة التسليم غير موجودة." });
        if (invoice.receivedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "تأكيد الاستلام متاح للمستلم المسجل فقط." });
        if (invoice.receiptConfirmedAt) throw new TRPCError({ code: "CONFLICT", message: "تم تأكيد استلام هذه الفاتورة مسبقًا." });
        const confirmedAt = new Date();
        await tx.update(handoverInvoices).set({ receiptConfirmedAt: confirmedAt, receiptConfirmationName: input.confirmationName.trim(), receiptNote: optionalText(input.receiptNote) }).where(eq(handoverInvoices.id, invoice.id));
        await tx.insert(warehouseActivities).values({ type: "handover_receipt_confirmed", actorId: ctx.user.id, title: "تأكيد استلام رقمي", detail: `أكد ${input.confirmationName.trim()} استلام الفاتورة ${invoice.invoiceNumber}.`, requestId: invoice.requestId, partId: invoice.partId });
        return { success: true, receiptConfirmedAt: confirmedAt } as const;
      });
    }),
  }),

  transactions: adminProcedure.query(async () => {
    const db = await requireDb();
    return db
      .select({
        transaction: inventoryTransactions,
        engineer: { id: users.id, name: users.name, email: users.email },
      })
      .from(inventoryTransactions)
      .leftJoin(users, eq(inventoryTransactions.engineerId, users.id))
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(100);
  }),

  alerts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return ctx.user.role === "admin"
        ? db.select().from(warehouseAlerts).where(isNull(warehouseAlerts.recipientUserId)).orderBy(desc(warehouseAlerts.createdAt)).limit(100)
        : db.select().from(warehouseAlerts).where(eq(warehouseAlerts.recipientUserId, ctx.user.id)).orderBy(desc(warehouseAlerts.createdAt)).limit(100);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [alert] = await db.select().from(warehouseAlerts).where(eq(warehouseAlerts.id, input.id)).limit(1);
      if (!alert) throw new TRPCError({ code: "NOT_FOUND", message: "التنبيه غير موجود." });
      const canMarkRead = ctx.user.role === "admin" ? alert.recipientUserId === null : alert.recipientUserId === ctx.user.id;
      if (!canMarkRead) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تحديث هذا التنبيه." });
      await db.update(warehouseAlerts).set({ isRead: 1 }).where(eq(warehouseAlerts.id, input.id));
      return { success: true } as const;
    }),
  }),
});
