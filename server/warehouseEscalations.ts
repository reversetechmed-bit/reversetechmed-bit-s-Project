import { eq } from "drizzle-orm";
import { dispensingRequests, handoverInvoices, parts, warehouseAlerts } from "../drizzle/schema";
import { getDb } from "./db";
import { buildOperationalEscalations } from "./warehouseOperations";
import { runDueWarehouseReports } from "./warehouseReports";

export async function runOperationalEscalationSweep(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Operational escalation database is unavailable.");
  const escalation = await db.transaction(async tx => {
    const [allParts, requestRows, invoiceRows] = await Promise.all([
      tx.select().from(parts),
      tx.select().from(dispensingRequests),
      tx.select().from(handoverInvoices),
    ]);
    const alerts = buildOperationalEscalations({ parts: allParts, requests: requestRows, invoices: invoiceRows, now });
    let created = 0;
    for (const alert of alerts) {
      const [existing] = await tx.select({ id: warehouseAlerts.id }).from(warehouseAlerts).where(eq(warehouseAlerts.dedupeKey, alert.dedupeKey)).limit(1);
      if (existing) continue;
      await tx.insert(warehouseAlerts).values(alert);
      created += 1;
    }
    return { evaluated: alerts.length, created } as const;
  });
  const reports = await runDueWarehouseReports(now);
  return { ...escalation, reports };
}
