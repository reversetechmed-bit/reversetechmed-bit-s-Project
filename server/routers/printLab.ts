import { and, asc, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  printLabMaterialMovementTypeValues,
  printLabMaterialMovements,
  printLabMaterials,
  printLabOrderStatusValues,
  printLabOrders,
  printLabPrinterStatusValues,
  printLabPrinters,
  printLabRuns,
} from "../../drizzle/schema";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { preparePrintLabMaterialMovement } from "../printLabOperations";

function optionalText(value?: string) {
  return value?.trim() ? value.trim() : null;
}

function makeOrderDraftNumber() {
  return `TMP-3DP-${nanoid(12).toUpperCase()}`;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "بيانات معمل الطباعة غير متاحة مؤقتًا." });
  return db;
}

const printerInput = z.object({
  name: z.string().trim().min(2).max(160),
  model: z.string().trim().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const materialInput = z.object({
  name: z.string().trim().min(2).max(160),
  materialType: z.string().trim().min(2).max(80),
  color: z.string().trim().max(80).optional(),
  spoolCode: z.string().trim().max(80).optional(),
  initialGrams: z.number().int().min(0).max(100_000).default(0),
  minimumGrams: z.number().int().min(0).max(100_000).default(0),
  notes: z.string().trim().max(2000).optional(),
});

const orderInput = z.object({
  title: z.string().trim().min(2).max(200),
  receivedFrom: z.string().trim().max(160).optional(),
  deliveredTo: z.string().trim().max(160).optional(),
  printerId: z.number().int().positive().optional(),
  materialId: z.number().int().positive().optional(),
  expectedGrams: z.number().int().min(0).max(100_000).default(0),
  notes: z.string().trim().max(2000).optional(),
});

const runInput = z.object({
  orderId: z.number().int().positive(),
  printerId: z.number().int().positive(),
  materialId: z.number().int().positive(),
  gramsUsed: z.number().int().positive().max(100_000),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const printLabRouter = router({
  overview: adminProcedure.query(async () => {
    const db = await requireDb();
    const [printers, materials, orderRows, runRows, movementRows] = await Promise.all([
      db.select().from(printLabPrinters).orderBy(asc(printLabPrinters.name)),
      db.select().from(printLabMaterials).orderBy(asc(printLabMaterials.name)),
      db.select({ order: printLabOrders, printer: printLabPrinters, material: printLabMaterials })
        .from(printLabOrders)
        .leftJoin(printLabPrinters, eq(printLabOrders.printerId, printLabPrinters.id))
        .leftJoin(printLabMaterials, eq(printLabOrders.materialId, printLabMaterials.id))
        .orderBy(desc(printLabOrders.createdAt)),
      db.select({ run: printLabRuns, printer: printLabPrinters, material: printLabMaterials, order: printLabOrders })
        .from(printLabRuns)
        .innerJoin(printLabPrinters, eq(printLabRuns.printerId, printLabPrinters.id))
        .innerJoin(printLabMaterials, eq(printLabRuns.materialId, printLabMaterials.id))
        .leftJoin(printLabOrders, eq(printLabRuns.orderId, printLabOrders.id))
        .orderBy(desc(printLabRuns.startedAt))
        .limit(120),
      db.select({ movement: printLabMaterialMovements, material: printLabMaterials, printer: printLabPrinters, order: printLabOrders })
        .from(printLabMaterialMovements)
        .innerJoin(printLabMaterials, eq(printLabMaterialMovements.materialId, printLabMaterials.id))
        .leftJoin(printLabPrinters, eq(printLabMaterialMovements.printerId, printLabPrinters.id))
        .leftJoin(printLabOrders, eq(printLabMaterialMovements.orderId, printLabOrders.id))
        .orderBy(desc(printLabMaterialMovements.occurredAt))
        .limit(160),
    ]);
    return { printers, materials, orders: orderRows, runs: runRows, movements: movementRows };
  }),

  createPrinter: adminProcedure.input(printerInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [existing] = await db.select({ id: printLabPrinters.id }).from(printLabPrinters).where(eq(printLabPrinters.name, input.name.trim())).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "يوجد بالفعل طابعة بهذا الاسم داخل المعمل." });
    const ids = await db.insert(printLabPrinters).values({
      name: input.name.trim(),
      model: optionalText(input.model),
      location: optionalText(input.location),
      notes: optionalText(input.notes),
      createdById: ctx.user.id,
    }).$returningId();
    return { id: ids[0]?.id } as const;
  }),

  setPrinterStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(printLabPrinterStatusValues) })).mutation(async ({ input }) => {
    const db = await requireDb();
    const [printer] = await db.select().from(printLabPrinters).where(eq(printLabPrinters.id, input.id)).limit(1);
    if (!printer) throw new TRPCError({ code: "NOT_FOUND", message: "الطابعة غير موجودة." });
    await db.update(printLabPrinters).set({ status: input.status }).where(eq(printLabPrinters.id, input.id));
    return { success: true } as const;
  }),

  createMaterial: adminProcedure.input(materialInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    return db.transaction(async tx => {
      const spoolCode = optionalText(input.spoolCode);
      if (spoolCode) {
        const [existing] = await tx.select({ id: printLabMaterials.id }).from(printLabMaterials).where(eq(printLabMaterials.spoolCode, spoolCode)).limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "كود بكرة الفيلمنت مستخدم بالفعل." });
      }
      const ids = await tx.insert(printLabMaterials).values({
        name: input.name.trim(),
        materialType: input.materialType.trim(),
        color: optionalText(input.color),
        spoolCode,
        availableGrams: input.initialGrams,
        minimumGrams: input.minimumGrams,
        notes: optionalText(input.notes),
        createdById: ctx.user.id,
      }).$returningId();
      const id = ids[0]?.id;
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تسجيل مادة الطباعة." });
      if (input.initialGrams > 0) await tx.insert(printLabMaterialMovements).values({
        materialId: id,
        type: "inbound",
        gramsDelta: input.initialGrams,
        gramsBefore: 0,
        gramsAfter: input.initialGrams,
        reason: "رصيد افتتاحي لمادة الطباعة.",
        occurredAt: new Date(),
        createdById: ctx.user.id,
      });
      return { id } as const;
    });
  }),

  adjustMaterial: adminProcedure.input(z.object({
    materialId: z.number().int().positive(),
    type: z.enum(printLabMaterialMovementTypeValues).refine(type => type !== "consumed", "الاستهلاك يسجل من سجل تشغيل الطابعة فقط."),
    grams: z.number().int().positive().max(100_000),
    reason: z.string().trim().min(2).max(2000),
    occurredAt: z.string().datetime({ offset: true }).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    return db.transaction(async tx => {
      const [material] = await tx.select().from(printLabMaterials).where(eq(printLabMaterials.id, input.materialId)).limit(1);
      if (!material) throw new TRPCError({ code: "NOT_FOUND", message: "مادة الطباعة غير موجودة." });
      const plan = preparePrintLabMaterialMovement({ material, type: input.type, grams: input.grams, reason: input.reason });
      if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
      await tx.update(printLabMaterials).set({ availableGrams: plan.availableGramsAfter }).where(eq(printLabMaterials.id, material.id));
      await tx.insert(printLabMaterialMovements).values({
        materialId: material.id,
        type: input.type,
        gramsDelta: plan.gramsDelta,
        gramsBefore: material.availableGrams,
        gramsAfter: plan.availableGramsAfter,
        reason: input.reason.trim(),
        occurredAt,
        createdById: ctx.user.id,
      });
      return { success: true, availableGramsAfter: plan.availableGramsAfter } as const;
    });
  }),

  createOrder: adminProcedure.input(orderInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    return db.transaction(async tx => {
      if (input.printerId) {
        const [printer] = await tx.select({ id: printLabPrinters.id }).from(printLabPrinters).where(eq(printLabPrinters.id, input.printerId)).limit(1);
        if (!printer) throw new TRPCError({ code: "BAD_REQUEST", message: "الطابعة المحددة غير موجودة." });
      }
      if (input.materialId) {
        const [material] = await tx.select({ id: printLabMaterials.id }).from(printLabMaterials).where(and(eq(printLabMaterials.id, input.materialId), eq(printLabMaterials.isActive, 1))).limit(1);
        if (!material) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر مادة طباعة نشطة." });
      }
      const createdAt = new Date();
      const ids = await tx.insert(printLabOrders).values({
        orderNumber: makeOrderDraftNumber(),
        title: input.title.trim(),
        receivedFrom: optionalText(input.receivedFrom),
        deliveredTo: optionalText(input.deliveredTo),
        printerId: input.printerId ?? null,
        materialId: input.materialId ?? null,
        expectedGrams: input.expectedGrams,
        notes: optionalText(input.notes),
        createdById: ctx.user.id,
        createdAt,
      }).$returningId();
      const id = ids[0]?.id;
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تسجيل أمر الطباعة." });
      const orderNumber = `RT-3DP-${createdAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(id).padStart(5, "0")}`;
      await tx.update(printLabOrders).set({ orderNumber }).where(eq(printLabOrders.id, id));
      return { id, orderNumber } as const;
    });
  }),

  startOrder: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb();
    return db.transaction(async tx => {
      const [order] = await tx.select().from(printLabOrders).where(eq(printLabOrders.id, input.id)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "أمر الطباعة غير موجود." });
      if (!order.printerId || !order.materialId) throw new TRPCError({ code: "CONFLICT", message: "عيّن طابعة وفيلمنت للأمر قبل بدء التشغيل." });
      if (order.status !== "received" && order.status !== "scheduled") throw new TRPCError({ code: "CONFLICT", message: "لا يمكن بدء هذا الأمر بحالته الحالية." });
      const [printer] = await tx.select().from(printLabPrinters).where(eq(printLabPrinters.id, order.printerId)).limit(1);
      if (!printer || printer.status === "offline" || printer.status === "maintenance" || printer.status === "printing") throw new TRPCError({ code: "CONFLICT", message: "الطابعة غير متاحة الآن للتشغيل." });
      const startedAt = new Date();
      await tx.update(printLabOrders).set({ status: "printing", startedAt }).where(eq(printLabOrders.id, order.id));
      await tx.update(printLabPrinters).set({ status: "printing" }).where(eq(printLabPrinters.id, order.printerId));
      return { success: true, startedAt } as const;
    });
  }),

  logRun: adminProcedure.input(runInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    return db.transaction(async tx => {
      const [order] = await tx.select().from(printLabOrders).where(eq(printLabOrders.id, input.orderId)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "أمر الطباعة غير موجود." });
      if (order.status !== "printing") throw new TRPCError({ code: "CONFLICT", message: "سجل التشغيل يقبل أوامر قيد الطباعة فقط." });
      if (order.printerId !== input.printerId || order.materialId !== input.materialId) throw new TRPCError({ code: "CONFLICT", message: "يجب أن يطابق سجل التشغيل الطابعة والفيلمنت المحددين في الأمر." });
      const [printer] = await tx.select().from(printLabPrinters).where(eq(printLabPrinters.id, input.printerId)).limit(1);
      const [material] = await tx.select().from(printLabMaterials).where(eq(printLabMaterials.id, input.materialId)).limit(1);
      if (!printer || !material) throw new TRPCError({ code: "BAD_REQUEST", message: "لم تعد الطابعة أو مادة الطباعة متاحة." });
      const plan = preparePrintLabMaterialMovement({ material, type: "consumed", grams: input.gramsUsed, reason: `استهلاك طباعة للأمر ${order.orderNumber}` });
      if (!plan.ok) throw new TRPCError({ code: "CONFLICT", message: plan.reason });
      const startedAt = new Date(input.startedAt);
      const endedAt = input.endedAt ? new Date(input.endedAt) : null;
      if (endedAt && endedAt < startedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "وقت نهاية التشغيل يجب أن يكون بعد وقت البداية." });
      await tx.update(printLabMaterials).set({ availableGrams: plan.availableGramsAfter }).where(eq(printLabMaterials.id, material.id));
      await tx.insert(printLabRuns).values({ printerId: printer.id, orderId: order.id, materialId: material.id, gramsUsed: input.gramsUsed, startedAt, endedAt, notes: optionalText(input.notes), loggedById: ctx.user.id });
      await tx.insert(printLabMaterialMovements).values({
        materialId: material.id,
        orderId: order.id,
        printerId: printer.id,
        type: "consumed",
        gramsDelta: plan.gramsDelta,
        gramsBefore: material.availableGrams,
        gramsAfter: plan.availableGramsAfter,
        reason: `استهلاك ${input.gramsUsed} جم للأمر ${order.orderNumber}.`,
        occurredAt: endedAt ?? startedAt,
        createdById: ctx.user.id,
      });
      await tx.update(printLabOrders).set({ actualGramsUsed: order.actualGramsUsed + input.gramsUsed }).where(eq(printLabOrders.id, order.id));
      return { success: true, availableGramsAfter: plan.availableGramsAfter, actualGramsUsed: order.actualGramsUsed + input.gramsUsed } as const;
    });
  }),

  completeOrder: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb();
    return db.transaction(async tx => {
      const [order] = await tx.select().from(printLabOrders).where(eq(printLabOrders.id, input.id)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "أمر الطباعة غير موجود." });
      if (order.status !== "printing") throw new TRPCError({ code: "CONFLICT", message: "لا يمكن إنهاء أمر غير قيد الطباعة." });
      const completedAt = new Date();
      await tx.update(printLabOrders).set({ status: "completed", completedAt }).where(eq(printLabOrders.id, order.id));
      if (order.printerId) await tx.update(printLabPrinters).set({ status: "available" }).where(eq(printLabPrinters.id, order.printerId));
      return { success: true, completedAt } as const;
    });
  }),

  deliverOrder: adminProcedure.input(z.object({ id: z.number().int().positive(), deliveredTo: z.string().trim().min(2).max(160) })).mutation(async ({ input }) => {
    const db = await requireDb();
    const [order] = await db.select().from(printLabOrders).where(eq(printLabOrders.id, input.id)).limit(1);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "أمر الطباعة غير موجود." });
    if (order.status !== "completed") throw new TRPCError({ code: "CONFLICT", message: "يجب إكمال الطباعة قبل تسليمها." });
    const deliveredAt = new Date();
    await db.update(printLabOrders).set({ status: "delivered", deliveredTo: input.deliveredTo.trim(), deliveredAt }).where(eq(printLabOrders.id, order.id));
    return { success: true, deliveredAt } as const;
  }),
});
