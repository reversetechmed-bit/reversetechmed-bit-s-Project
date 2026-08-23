import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parts, serialAssetEvents, serialAssets, serialAssetStatusValues, storageLocations, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { router, warehousePermissionProcedure } from "../_core/trpc";
import { makeLocationBarcode, makePartBarcode, normalizeWarehouseBarcode, serialEventTypeForTransition, validateSerialTransition } from "../warehouseTraceability";

const optionalText = (value?: string) => value?.trim() ? value.trim() : null;

const locationInput = z.object({
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(160),
  shelf: z.string().trim().max(80).optional(),
  drawer: z.string().trim().max(80).optional(),
  box: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const serialRegistrationInput = z.object({
  partId: z.number().int().positive(),
  serialNumber: z.string().trim().min(2).max(160),
  manufacturerSerial: z.string().trim().max(160).optional(),
  locationId: z.number().int().positive().nullable().optional(),
  assetCondition: z.string().trim().max(160).optional(),
  acquiredAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const serialMoveInput = z.object({
  id: z.number().int().positive(),
  status: z.enum(serialAssetStatusValues),
  holderId: z.number().int().positive().nullable().optional(),
  locationId: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(2000).optional(),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "بيانات التتبع غير متاحة مؤقتًا." });
  return db;
}

async function ensureLocationIsUsable(db: { select: (...args: any[]) => any }, locationId: number | null | undefined) {
  if (!locationId) return;
  const [location] = await db.select({ id: storageLocations.id }).from(storageLocations).where(and(eq(storageLocations.id, locationId), eq(storageLocations.isActive, 1))).limit(1);
  if (!location) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر موقع تخزين نشطًا." });
}

export const traceabilityRouter = router({
  lookup: warehousePermissionProcedure("view_inventory").input(z.object({ barcode: z.string().trim().min(2).max(100) })).query(async ({ input }) => {
    const db = await requireDb();
    const barcode = normalizeWarehouseBarcode(input.barcode);
    const [[part], [location], [asset]] = await Promise.all([
      db.select().from(parts).where(eq(parts.barcode, barcode)).limit(1),
      db.select().from(storageLocations).where(eq(storageLocations.barcode, barcode)).limit(1),
      db.select().from(serialAssets).where(eq(serialAssets.serialNumber, input.barcode.trim().toUpperCase())).limit(1),
    ]);
    if (part) return { kind: "part" as const, part };
    if (location) return { kind: "location" as const, location };
    if (asset) return { kind: "asset" as const, asset };
    return null;
  }),

  labels: router({
    parts: warehousePermissionProcedure("view_inventory").input(z.object({ ids: z.array(z.number().int().positive()).max(100).optional() }).optional()).query(async ({ input }) => {
      const db = await requireDb();
      const rows = await db.select().from(parts).orderBy(parts.name);
      return input?.ids?.length ? rows.filter(part => input.ids!.includes(part.id)) : rows.filter(part => Boolean(part.barcode));
    }),
    locations: warehousePermissionProcedure("view_inventory").query(async () => {
      const db = await requireDb();
      return db.select().from(storageLocations).where(eq(storageLocations.isActive, 1)).orderBy(storageLocations.name);
    }),
  }),

  locations: router({
    list: warehousePermissionProcedure("view_inventory").query(async () => {
      const db = await requireDb();
      return db.select().from(storageLocations).orderBy(storageLocations.isActive, storageLocations.name);
    }),
    create: warehousePermissionProcedure("manage_traceability").input(locationInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        return await db.transaction(async tx => {
          const inserted = await tx.insert(storageLocations).values({
            code: input.code.trim().toUpperCase(),
            name: input.name,
            barcode: "TMP-LOCATION",
            shelf: optionalText(input.shelf),
            drawer: optionalText(input.drawer),
            box: optionalText(input.box),
            notes: optionalText(input.notes),
            createdById: ctx.user.id,
          }).$returningId();
          const id = inserted[0]?.id;
          if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء موقع التخزين." });
          const barcode = makeLocationBarcode({ id, code: input.code });
          await tx.update(storageLocations).set({ barcode }).where(eq(storageLocations.id, id));
          const [created] = await tx.select().from(storageLocations).where(eq(storageLocations.id, id)).limit(1);
          if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تجهيز ملصق الموقع." });
          return created;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "CONFLICT", message: "يوجد موقع تخزين بنفس الرمز أو الباركود." });
      }
    }),
    update: warehousePermissionProcedure("manage_traceability").input(locationInput.extend({ id: z.number().int().positive(), isActive: z.boolean().optional() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const [existing] = await db.select().from(storageLocations).where(eq(storageLocations.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "موقع التخزين غير موجود." });
      const nextCode = input.code.trim().toUpperCase();
      try {
        await db.update(storageLocations).set({
          code: nextCode,
          name: input.name,
          shelf: optionalText(input.shelf),
          drawer: optionalText(input.drawer),
          box: optionalText(input.box),
          notes: optionalText(input.notes),
          isActive: input.isActive === undefined ? existing.isActive : Number(input.isActive),
          barcode: existing.code === nextCode ? existing.barcode : makeLocationBarcode({ id: existing.id, code: nextCode }),
        }).where(eq(storageLocations.id, existing.id));
        return { success: true } as const;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "يوجد موقع تخزين بنفس الرمز أو الباركود." });
      }
    }),
  }),

  parts: router({
    assignBarcode: warehousePermissionProcedure("manage_traceability").input(z.object({ partId: z.number().int().positive(), barcode: z.string().trim().max(100).optional() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const [part] = await db.select().from(parts).where(eq(parts.id, input.partId)).limit(1);
      if (!part) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود." });
      const barcode = input.barcode ? normalizeWarehouseBarcode(input.barcode) : makePartBarcode(part);
      try {
        await db.update(parts).set({ barcode }).where(eq(parts.id, part.id));
        return { barcode } as const;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "الباركود مستخدم لصنف آخر." });
      }
    }),
  }),

  serialAssets: router({
    list: warehousePermissionProcedure("view_inventory").query(async () => {
      const db = await requireDb();
      return db.select({ asset: serialAssets, part: { id: parts.id, name: parts.name, partNumber: parts.partNumber, barcode: parts.barcode }, location: { id: storageLocations.id, name: storageLocations.name, code: storageLocations.code }, holder: { id: users.id, name: users.name } })
        .from(serialAssets)
        .innerJoin(parts, eq(serialAssets.partId, parts.id))
        .leftJoin(storageLocations, eq(serialAssets.locationId, storageLocations.id))
        .leftJoin(users, eq(serialAssets.currentHolderId, users.id))
        .orderBy(desc(serialAssets.updatedAt));
    }),
    history: warehousePermissionProcedure("view_inventory").input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb();
      return db.select({ event: serialAssetEvents, actor: { id: users.id, name: users.name } }).from(serialAssetEvents).leftJoin(users, eq(serialAssetEvents.actorId, users.id)).where(eq(serialAssetEvents.serialAssetId, input.id)).orderBy(desc(serialAssetEvents.createdAt));
    }),
    register: warehousePermissionProcedure("manage_traceability").input(serialRegistrationInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [part] = await tx.select().from(parts).where(eq(parts.id, input.partId)).limit(1);
        if (!part) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف المحدد غير موجود." });
        if (part.serialTrackingMode !== "serial") throw new TRPCError({ code: "CONFLICT", message: "فعّل التتبع التسلسلي للصنف قبل تسجيل وحدة مفردة." });
        await ensureLocationIsUsable(tx, input.locationId);
        const serialNumber = input.serialNumber.trim().toUpperCase();
        try {
          const inserted = await tx.insert(serialAssets).values({
            partId: part.id,
            serialNumber,
            status: "in_stock",
            locationId: input.locationId ?? null,
            assetCondition: optionalText(input.assetCondition),
            manufacturerSerial: optionalText(input.manufacturerSerial),
            acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : null,
            notes: optionalText(input.notes),
            createdById: ctx.user.id,
          }).$returningId();
          const id = inserted[0]?.id;
          if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تسجيل الوحدة التسلسلية." });
          await tx.insert(serialAssetEvents).values({ serialAssetId: id, type: "registered", toStatus: "in_stock", locationId: input.locationId ?? null, actorId: ctx.user.id, note: "تسجيل وحدة تسلسلية جديدة." });
          return { id, serialNumber } as const;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "CONFLICT", message: "الرقم التسلسلي مسجل بالفعل." });
        }
      });
    }),
    move: warehousePermissionProcedure("manage_traceability").input(serialMoveInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [asset] = await tx.select().from(serialAssets).where(eq(serialAssets.id, input.id)).limit(1);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "الوحدة التسلسلية غير موجودة." });
        const nextHolderId = input.status === "in_custody" ? input.holderId ?? null : null;
        const transition = validateSerialTransition({ from: asset.status, to: input.status, currentHolderId: nextHolderId });
        if (!transition.ok) throw new TRPCError({ code: "CONFLICT", message: transition.reason });
        if (nextHolderId) {
          const [holder] = await tx.select({ id: users.id }).from(users).where(eq(users.id, nextHolderId)).limit(1);
          if (!holder) throw new TRPCError({ code: "BAD_REQUEST", message: "الحائز المحدد غير موجود." });
        }
        const nextLocationId = input.status === "in_custody" ? null : input.locationId === undefined ? asset.locationId : input.locationId;
        await ensureLocationIsUsable(tx, nextLocationId);
        await tx.update(serialAssets).set({ status: input.status, currentHolderId: nextHolderId, locationId: nextLocationId }).where(eq(serialAssets.id, asset.id));
        await tx.insert(serialAssetEvents).values({ serialAssetId: asset.id, type: serialEventTypeForTransition(input.status), fromStatus: asset.status, toStatus: input.status, locationId: nextLocationId, holderId: nextHolderId, actorId: ctx.user.id, note: optionalText(input.note) });
        return { success: true } as const;
      });
    }),
  }),
});
