import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { warehouseReportFrequencyValues, warehouseReportSchedules, warehouseReportTypeValues } from "../../drizzle/schema";
import { getDb } from "../db";
import { router, warehousePermissionProcedure } from "../_core/trpc";
import { buildWarehouseReportDigest, calculateNextReportRun } from "../warehouseReports";

async function requireDb() { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "إعدادات التقارير غير متاحة مؤقتًا." }); return db; }

const scheduleInput = z.object({ name: z.string().trim().min(3).max(160), reportType: z.enum(warehouseReportTypeValues), frequency: z.enum(warehouseReportFrequencyValues), weekday: z.number().int().min(0).max(6).nullable().optional(), runHourUtc: z.number().int().min(0).max(23) });

export const reportsRouter = router({
  preview: warehousePermissionProcedure("view_reports").input(z.object({ reportType: z.enum(warehouseReportTypeValues) })).query(({ input }) => buildWarehouseReportDigest(input.reportType)),
  schedules: router({
    list: warehousePermissionProcedure("manage_reports").query(async () => { const db = await requireDb(); return db.select().from(warehouseReportSchedules).orderBy(desc(warehouseReportSchedules.createdAt)); }),
    create: warehousePermissionProcedure("manage_reports").input(scheduleInput).mutation(async ({ ctx, input }) => {
      if (input.frequency === "weekly" && input.weekday === null) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر يومًا أسبوعيًا للتقرير الأسبوعي." });
      const db = await requireDb(); const now = new Date(); const nextRunAt = calculateNextReportRun({ frequency: input.frequency, runHourUtc: input.runHourUtc, weekday: input.frequency === "weekly" ? input.weekday : null, now });
      const inserted = await db.insert(warehouseReportSchedules).values({ name: input.name, reportType: input.reportType, frequency: input.frequency, weekday: input.frequency === "weekly" ? input.weekday ?? null : null, runHourUtc: input.runHourUtc, recipientUserId: ctx.user.id, createdById: ctx.user.id, nextRunAt }).$returningId();
      return { id: inserted[0]?.id, nextRunAt } as const;
    }),
    setActive: warehousePermissionProcedure("manage_reports").input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ input }) => { const db = await requireDb(); await db.update(warehouseReportSchedules).set({ isActive: Number(input.isActive) }).where(eq(warehouseReportSchedules.id, input.id)); return { success: true } as const; }),
    remove: warehousePermissionProcedure("manage_reports").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => { const db = await requireDb(); await db.delete(warehouseReportSchedules).where(eq(warehouseReportSchedules.id, input.id)); return { success: true } as const; }),
  }),
});
