import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  dispensingRequests,
  partCategoryValues,
  parts,
  inventoryTransactions,
  users,
  warehouseAlerts,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { executeConfirmedDelivery } from "../warehouseDelivery";
import { canDecideRequest, canEngineerSubmit, isLowStock } from "../warehouseRules";
import { z } from "zod";

const partInput = z.object({
  partNumber: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(partCategoryValues),
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
      message: "Warehouse data is temporarily unavailable.",
    });
  }
  return db;
}

function optionalText(value?: string) {
  return value?.trim() ? value.trim() : null;
}

const engineerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!canEngineerSubmit(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only engineers can submit dispensing requests." });
  }
  return next({ ctx });
});

export const warehouseRouter = router({
  inventory: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(parts).orderBy(desc(parts.updatedAt));
    }),

    lowStock: adminProcedure.query(async () => {
      const db = await requireDb();
      const allParts = await db.select().from(parts).orderBy(desc(parts.updatedAt));
      return allParts.filter(part => part.quantity < part.minimumStock);
    }),

    create: adminProcedure.input(partInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        return await db.transaction(async tx => {
          await tx.insert(parts).values({
            ...input,
            description: optionalText(input.description),
            location: optionalText(input.location),
            createdById: ctx.user.id,
          });
          const [created] = await tx
            .select()
            .from(parts)
            .where(eq(parts.partNumber, input.partNumber))
            .limit(1);

          if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Part creation failed." });

          await tx.insert(inventoryTransactions).values({
            partId: created.id,
            type: "part_created",
            quantityDelta: input.quantity,
            quantityBefore: 0,
            quantityAfter: input.quantity,
            actorId: ctx.user.id,
            partNumberSnapshot: created.partNumber,
            partNameSnapshot: created.name,
            details: "Part added to inventory.",
          });

          if (isLowStock(created.quantity, created.minimumStock)) {
            await tx.insert(warehouseAlerts).values({
              type: "low_stock",
              title: "Low stock warning",
              body: `${created.name} is below its minimum stock threshold.`,
              partId: created.id,
            });
          }
          return created;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "CONFLICT", message: "A part with this part number already exists." });
      }
    }),

    update: adminProcedure
      .input(partInput.extend({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, ...values } = input;
        return db.transaction(async tx => {
          const [existing] = await tx.select().from(parts).where(eq(parts.id, id)).limit(1);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Part not found." });
          if (existing.partNumber !== values.partNumber) {
            const [duplicate] = await tx.select({ id: parts.id }).from(parts).where(eq(parts.partNumber, values.partNumber)).limit(1);
            if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "A part with this part number already exists." });
          }

          await tx
            .update(parts)
            .set({
              ...values,
              description: optionalText(values.description),
              location: optionalText(values.location),
            })
            .where(eq(parts.id, id));
          const [updated] = await tx.select().from(parts).where(eq(parts.id, id)).limit(1);
          if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Part update failed." });

          await tx.insert(inventoryTransactions).values({
            partId: updated.id,
            type: "part_updated",
            quantityDelta: updated.quantity - existing.quantity,
            quantityBefore: existing.quantity,
            quantityAfter: updated.quantity,
            actorId: ctx.user.id,
            partNumberSnapshot: updated.partNumber,
            partNameSnapshot: updated.name,
            details: "Part record updated by warehouse admin.",
          });

          if (isLowStock(updated.quantity, updated.minimumStock)) {
            const [existingAlert] = await tx
              .select({ id: warehouseAlerts.id })
              .from(warehouseAlerts)
              .where(and(eq(warehouseAlerts.type, "low_stock"), eq(warehouseAlerts.partId, updated.id), eq(warehouseAlerts.isRead, 0)))
              .limit(1);
            if (!existingAlert) {
              await tx.insert(warehouseAlerts).values({
                type: "low_stock",
                title: "Low stock warning",
                body: `${updated.name} is below its minimum stock threshold.`,
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
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Part not found." });
      const [request] = await db.select({ id: dispensingRequests.id }).from(dispensingRequests).where(eq(dispensingRequests.partId, input.id)).limit(1);
      const [transaction] = await db.select({ id: inventoryTransactions.id }).from(inventoryTransactions).where(eq(inventoryTransactions.partId, input.id)).limit(1);
      if (request || transaction) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Parts with recorded requests or movements cannot be deleted; this preserves the audit history.",
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

      return ctx.user.role === "admin"
        ? baseQuery.orderBy(desc(dispensingRequests.createdAt))
        : baseQuery.where(eq(dispensingRequests.requestedById, ctx.user.id)).orderBy(desc(dispensingRequests.createdAt));
    }),

    create: engineerProcedure.input(requestInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const result = await db.transaction(async tx => {
        const [part] = await tx.select().from(parts).where(eq(parts.id, input.partId)).limit(1);
        if (!part) throw new TRPCError({ code: "NOT_FOUND", message: "The requested part no longer exists." });
        if (part.quantity < input.requestedQuantity) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The requested quantity exceeds the available inventory." });
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
        if (!requestId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Request creation failed." });

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
          details: `Requested ${input.requestedQuantity} unit(s). Purpose: ${input.purpose}`,
        });
        await tx.insert(warehouseAlerts).values({
          type: "new_request",
          title: "New dispensing request",
          body: `${ctx.user.name || "An engineer"} requested ${input.requestedQuantity} × ${part.name}.`,
          partId: part.id,
          requestId,
        });
        return { requestId, partName: part.name };
      });

      const notificationSent = await notifyOwner({
        title: "New warehouse dispensing request",
        content: `${ctx.user.name || "An engineer"} requested ${input.requestedQuantity} × ${result.partName}.`,
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
          if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
          if (!canDecideRequest(record.request.status)) {
            throw new TRPCError({ code: "CONFLICT", message: "Only pending requests can be approved or rejected." });
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
            details: input.decision === "approved" ? "Request approved; awaiting physical handover." : `Request rejected.${input.decisionNote ? ` Reason: ${input.decisionNote}` : ""}`,
          });
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
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
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
        const { quantityAfter } = deliveryMovement;
        return { success: true, quantityAfter } as const;
      });
    }),
  }),

  dashboard: adminProcedure.query(async () => {
    const db = await requireDb();
    const [allParts, allRequests, unreadAlerts] = await Promise.all([
      db.select().from(parts).orderBy(desc(parts.updatedAt)),
      db.select().from(dispensingRequests).orderBy(desc(dispensingRequests.createdAt)),
      db.select().from(warehouseAlerts).where(eq(warehouseAlerts.isRead, 0)).orderBy(desc(warehouseAlerts.createdAt)),
    ]);
    return {
      partCount: allParts.length,
      totalUnits: allParts.reduce((sum, part) => sum + part.quantity, 0),
      pendingRequests: allRequests.filter(request => request.status === "pending").length,
      lowStockParts: allParts.filter(part => part.quantity < part.minimumStock),
      unreadAlerts,
    };
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
    list: adminProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(warehouseAlerts).orderBy(desc(warehouseAlerts.createdAt)).limit(100);
    }),
    markRead: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(warehouseAlerts).set({ isRead: 1 }).where(eq(warehouseAlerts.id, input.id));
      return { success: true } as const;
    }),
  }),
});
