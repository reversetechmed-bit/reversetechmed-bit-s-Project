import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runOperationalEscalationSweep } from "./warehouseEscalations";

/** Authenticated Heartbeat callback for rule-based warehouse escalation alerts. */
export async function scheduledEscalationsHandler(req: Request, res: Response) {
  try {
    const caller = await sdk.authenticateRequest(req);
    if (!caller.isCron || !caller.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await runOperationalEscalationSweep();
    return res.json({ ok: true, taskUid: caller.taskUid, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[Scheduled escalations]", error);
    return res.status(500).json({ error: message, stack, context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}
