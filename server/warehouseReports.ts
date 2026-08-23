import { and, eq } from "drizzle-orm";
import { custodyAssignments, inventoryCountLines, inventoryCountSessions, maintenanceCases, parts, serialAssets, warehouseAlerts, warehouseReportSchedules, workOrders } from "../drizzle/schema";
import { getDb } from "./db";

export type ReportFrequency = "daily" | "weekly";
export type ReportType = "low_stock" | "custody_overdue" | "maintenance_aging" | "count_variances" | "open_work_orders" | "serial_status";

export function calculateNextReportRun(input: { frequency: ReportFrequency; runHourUtc: number; weekday?: number | null; now: Date }) {
  if (!Number.isInteger(input.runHourUtc) || input.runHourUtc < 0 || input.runHourUtc > 23) throw new Error("ساعة تشغيل التقرير يجب أن تكون بين 0 و23 بتوقيت UTC.");
  if (input.frequency === "weekly" && (!Number.isInteger(input.weekday) || input.weekday! < 0 || input.weekday! > 6)) throw new Error("اليوم الأسبوعي يجب أن يكون بين 0 و6.");
  const result = new Date(Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), input.now.getUTCDate(), input.runHourUtc, 0, 0, 0));
  if (input.frequency === "daily") { if (result <= input.now) result.setUTCDate(result.getUTCDate() + 1); return result; }
  const target = input.weekday!;
  const delta = (target - result.getUTCDay() + 7) % 7;
  result.setUTCDate(result.getUTCDate() + delta);
  if (result <= input.now) result.setUTCDate(result.getUTCDate() + 7);
  return result;
}

type Digest = { title: string; body: string; count: number };
const truncateNames = (rows: string[]) => rows.slice(0, 4).join("، ") + (rows.length > 4 ? `، و${rows.length - 4} أخرى` : "");

export async function buildWarehouseReportDigest(reportType: ReportType, now = new Date()): Promise<Digest> {
  const db = await getDb();
  if (!db) throw new Error("Warehouse report database is unavailable.");
  if (reportType === "low_stock") {
    const rows = (await db.select().from(parts)).filter(part => Math.max(0, part.quantity - part.reservedQuantity - part.custodyQuantity) <= part.minimumStock);
    return { title: "تقرير النواقص", body: rows.length ? `يوجد ${rows.length} أصناف عند حدها الأدنى أو دونه: ${truncateNames(rows.map(row => row.name))}.` : "لا توجد أصناف تحت حدها الأدنى حاليًا.", count: rows.length };
  }
  if (reportType === "custody_overdue") {
    const rows = (await db.select().from(custodyAssignments)).filter(row => row.status === "active" && row.dueAt && row.dueAt < now);
    return { title: "تقرير العُهد المتأخرة", body: rows.length ? `يوجد ${rows.length} عُهدة نشطة تجاوزت تاريخ الإعادة: ${truncateNames(rows.map(row => row.custodyNumber))}.` : "لا توجد عُهد متأخرة حاليًا.", count: rows.length };
  }
  if (reportType === "maintenance_aging") {
    const rows = (await db.select().from(maintenanceCases)).filter(row => !["closed", "cancelled", "returned_to_stock"].includes(row.status) && now.getTime() - row.createdAt.getTime() >= 7 * 24 * 60 * 60 * 1000);
    return { title: "تقرير حالات الصيانة المتقادمة", body: rows.length ? `يوجد ${rows.length} حالات مفتوحة منذ سبعة أيام أو أكثر: ${truncateNames(rows.map(row => row.caseNumber))}.` : "لا توجد حالات صيانة متقادمة حاليًا.", count: rows.length };
  }
  if (reportType === "count_variances") {
    const lines = await db.select({ line: inventoryCountLines, session: inventoryCountSessions }).from(inventoryCountLines).innerJoin(inventoryCountSessions, eq(inventoryCountLines.sessionId, inventoryCountSessions.id));
    const rows = lines.filter(row => row.session.status === "approved" && row.line.varianceQuantity !== null && row.line.varianceQuantity !== 0);
    return { title: "تقرير فروقات الجرد", body: rows.length ? `يوجد ${rows.length} فروقات جرد معتمدة: ${truncateNames(rows.map(row => row.line.partNameSnapshot))}.` : "لا توجد فروقات جرد معتمدة ضمن السجل الحالي.", count: rows.length };
  }
  if (reportType === "open_work_orders") {
    const rows = (await db.select().from(workOrders)).filter(row => !["completed", "cancelled"].includes(row.status));
    return { title: "تقرير أوامر العمل المفتوحة", body: rows.length ? `يوجد ${rows.length} أوامر عمل غير مكتملة: ${truncateNames(rows.map(row => row.workOrderNumber))}.` : "لا توجد أوامر عمل مفتوحة حاليًا.", count: rows.length };
  }
  const rows = await db.select().from(serialAssets);
  const summary = Object.entries(rows.reduce<Record<string, number>>((acc, asset) => ({ ...acc, [asset.status]: (acc[asset.status] ?? 0) + 1 }), {})).map(([status, count]) => `${status}: ${count}`);
  return { title: "تقرير حالة الوحدات التسلسلية", body: rows.length ? `إجمالي الوحدات المسجلة ${rows.length}. ${summary.join(" · ")}.` : "لا توجد وحدات تسلسلية مسجلة حاليًا.", count: rows.length };
}

export async function runDueWarehouseReports(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Warehouse report database is unavailable.");
  const schedules = (await db.select().from(warehouseReportSchedules)).filter(schedule => schedule.isActive && schedule.nextRunAt <= now);
  let delivered = 0;
  for (const schedule of schedules) {
    await db.transaction(async tx => {
      const [current] = await tx.select().from(warehouseReportSchedules).where(eq(warehouseReportSchedules.id, schedule.id)).limit(1);
      if (!current || !current.isActive || current.nextRunAt > now) return;
      const digest = await buildWarehouseReportDigest(current.reportType, now);
      const dedupeKey = `scheduled-report:${current.id}:${current.nextRunAt.toISOString()}`;
      const [existing] = await tx.select({ id: warehouseAlerts.id }).from(warehouseAlerts).where(eq(warehouseAlerts.dedupeKey, dedupeKey)).limit(1);
      if (!existing) { await tx.insert(warehouseAlerts).values({ type: "scheduled_report", title: current.name || digest.title, body: digest.body, recipientUserId: current.recipientUserId, dedupeKey }); delivered += 1; }
      const nextRunAt = calculateNextReportRun({ frequency: current.frequency, runHourUtc: current.runHourUtc, weekday: current.weekday, now });
      await tx.update(warehouseReportSchedules).set({ lastRunAt: now, nextRunAt }).where(and(eq(warehouseReportSchedules.id, current.id), eq(warehouseReportSchedules.nextRunAt, current.nextRunAt)));
    });
  }
  return { evaluated: schedules.length, delivered } as const;
}
