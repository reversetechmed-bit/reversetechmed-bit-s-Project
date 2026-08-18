import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  dispensingRequests,
  handoverInvoices,
  partCategoryValues,
  warehouseSectionValues,
  parts,
  inventoryTransactions,
  users,
  warehouseAlerts,
  warehouseActivities,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { executeConfirmedDelivery } from "../warehouseDelivery";
import { buildDecisionNotification, buildHandoverNotification } from "../warehouseNotifications";
import { canDecideRequest, canEngineerSubmit, isLowStock, mustScopeRequestsToRequester } from "../warehouseRules";
import { z } from "zod";

const partInput = z.object({
  partNumber: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(partCategoryValues),
  warehouseSection: z.enum(warehouseSectionValues).default("components"),
  componentTypeId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(0),
  minimumStock: z.number().int().min(0),
  location: z.string().trim().max(160).optional(),
});

const requestInput = z.object({
  partId: z.number().int().positive(),
  requestedQuantity: z.number().int().positive(),
  purpose: z.string().trim().min(3).max(2000),
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
      return allParts.filter(part => part.quantity <= part.minimumStock);
    }),

    create: adminProcedure.input(partInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        return await db.transaction(async tx => {
          await tx.insert(parts).values({
            ...input,
            description: optionalText(input.description),
            location: optionalText(input.location),
            componentTypeId: input.warehouseSection === "components" ? input.componentTypeId ?? null : null,
            createdById: ctx.user.id,
          });
          const [created] = await tx
            .select()
            .from(parts)
            .where(eq(parts.partNumber, input.partNumber))
            .limit(1);

          if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر إنشاء القطعة." });

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
          if (existing.partNumber !== values.partNumber) {
            const [duplicate] = await tx.select({ id: parts.id }).from(parts).where(eq(parts.partNumber, values.partNumber)).limit(1);
            if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "توجد بالفعل قطعة بهذا الكود." });
          }

          await tx
            .update(parts)
            .set({
              ...values,
              description: optionalText(values.description),
              location: optionalText(values.location),
              componentTypeId: values.warehouseSection === "components" ? values.componentTypeId ?? null : null,
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

          if (isLowStock(updated.quantity, updated.minimumStock)) {
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
      const [transaction] = await db.select({ id: inventoryTransactions.id }).from(inventoryTransactions).where(eq(inventoryTransactions.partId, input.id)).limit(1);
      if (request || transaction) {
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
        if (part.quantity < input.requestedQuantity) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "الكمية المطلوبة تتجاوز المخزون المتاح." });
        }

        const insertedIds = await tx
          .insert(dispensingRequests)
          .values({
            partId: part.id,
            requestedById: ctx.user.id,
            requestedQuantity: input.requestedQuantity,
            purpose: input.purpose,
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
          details: `تم طلب ${input.requestedQuantity} وحدة. الغرض: ${input.purpose}`,
        });
        await tx.insert(warehouseAlerts).values({
          type: "new_request",
          title: `${warehouseSectionLabel(part.warehouseSection)}: طلب صرف جديد`,
          body: `طلب ${ctx.user.name || "مهندس"} عدد ${input.requestedQuantity} × ${part.name} من ${warehouseSectionLabel(part.warehouseSection)}.`,
          partId: part.id,
          requestId,
        });
        await tx.insert(warehouseActivities).values({ type: "request_submitted", actorId: ctx.user.id, title: "إرسال طلب صرف", detail: `تم طلب ${input.requestedQuantity} × ${part.name} من ${warehouseSectionLabel(part.warehouseSection)}.`, requestId, partId: part.id });
        return { requestId, partName: part.name };
      });

      const notificationSent = await notifyOwner({
        title: "طلب صرف جديد من المخزن",
        content: `طلب ${ctx.user.name || "مهندس"} عدد ${input.requestedQuantity} × ${result.partName}.`,
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

          await tx
            .update(dispensingRequests)
            .set({ status: input.decision, decisionNote: optionalText(input.decisionNote), reviewedById: ctx.user.id, reviewedAt: new Date() })
            .where(eq(dispensingRequests.id, input.id));
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
            details: input.decision === "approved" ? "تم اعتماد الطلب بانتظار التسليم الفعلي." : `تم رفض الطلب.${input.decisionNote ? ` السبب: ${input.decisionNote}` : ""}`,
          });
          await tx.insert(warehouseActivities).values({ type: input.decision === "approved" ? "request_approved" : "request_rejected", actorId: ctx.user.id, title: input.decision === "approved" ? "اعتماد طلب صرف" : "رفض طلب صرف", detail: `تم ${input.decision === "approved" ? "اعتماد" : "رفض"} طلب ${record.part.name}.`, requestId: record.request.id, partId: record.part.id });
          await tx.insert(warehouseAlerts).values(buildDecisionNotification({ decision: input.decision, decisionNote: input.decisionNote, partId: record.part.id, partName: record.part.name, requestId: record.request.id, recipientUserId: record.request.requestedById }));
          return { success: true, status: input.decision } as const;
        });
      }),

    confirmDelivery: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
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
        const deliveryMovement = await executeConfirmedDelivery(record, ctx.user.id, {
          updatePartQuantity: async (partId, quantity) => {
            await tx.update(parts).set({ quantity }).where(eq(parts.id, partId));
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
        });
        if (!deliveryMovement.ok) {
          throw new TRPCError({ code: "CONFLICT", message: deliveryMovement.reason });
        }
        await tx.insert(warehouseAlerts).values(buildHandoverNotification({ partId: record.part.id, partName: record.part.name, requestId: record.request.id, recipientUserId: record.request.requestedById, invoiceNumber: deliveryMovement.invoice.invoiceNumber }));
        const { quantityAfter } = deliveryMovement;
        return { success: true, quantityAfter, invoiceNumber: deliveryMovement.invoice.invoiceNumber } as const;
      });
    }),
  }),

  dashboard: adminProcedure.query(async () => {
    const db = await requireDb();
    const [allParts, allRequests, unreadAlerts, recentActivities, recentAccess] = await Promise.all([
      db.select().from(parts).orderBy(desc(parts.updatedAt)),
      db.select().from(dispensingRequests).orderBy(desc(dispensingRequests.createdAt)),
      db.select().from(warehouseAlerts).where(eq(warehouseAlerts.isRead, 0)).orderBy(desc(warehouseAlerts.createdAt)),
      db.select({ activity: warehouseActivities, actor: { id: users.id, name: users.name, email: users.email } }).from(warehouseActivities).leftJoin(users, eq(warehouseActivities.actorId, users.id)).orderBy(desc(warehouseActivities.createdAt)).limit(8),
      db.select({ id: users.id, name: users.name, email: users.email, lastSignedIn: users.lastSignedIn, role: users.role }).from(users).orderBy(desc(users.lastSignedIn)).limit(6),
    ]);
    return {
      partCount: allParts.length,
      totalUnits: allParts.reduce((sum, part) => sum + part.quantity, 0),
      componentCount: allParts.filter(part => part.warehouseSection === "components").length,
      componentUnits: allParts.filter(part => part.warehouseSection === "components").reduce((sum, part) => sum + part.quantity, 0),
      productCount: allParts.filter(part => part.warehouseSection === "products").length,
      productUnits: allParts.filter(part => part.warehouseSection === "products").reduce((sum, part) => sum + part.quantity, 0),
      pendingRequests: allRequests.filter(request => request.status === "pending").length,
      lowStockParts: allParts.filter(part => part.quantity < part.minimumStock),
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
        ? db.select().from(warehouseAlerts).orderBy(desc(warehouseAlerts.createdAt)).limit(100)
        : db.select().from(warehouseAlerts).where(eq(warehouseAlerts.recipientUserId, ctx.user.id)).orderBy(desc(warehouseAlerts.createdAt)).limit(100);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [alert] = await db.select().from(warehouseAlerts).where(eq(warehouseAlerts.id, input.id)).limit(1);
      if (!alert) throw new TRPCError({ code: "NOT_FOUND", message: "التنبيه غير موجود." });
      if (ctx.user.role !== "admin" && alert.recipientUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تحديث هذا التنبيه." });
      await db.update(warehouseAlerts).set({ isRead: 1 }).where(eq(warehouseAlerts.id, input.id));
      return { success: true } as const;
    }),
  }),
});
