import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
const runOperationalEscalationSweep = vi.hoisted(() => vi.fn());

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./warehouseEscalations", () => ({ runOperationalEscalationSweep }));

const { scheduledEscalationsHandler } = await import("./scheduledEscalations");

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("scheduled warehouse escalations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a regular session from invoking the scheduled callback", async () => {
    authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();
    await scheduledEscalationsHandler({ path: "/api/scheduled/warehouse-escalations" } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(runOperationalEscalationSweep).not.toHaveBeenCalled();
  });

  it("runs the shared sweep for an authenticated heartbeat identity", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "cron_warehouse" });
    runOperationalEscalationSweep.mockResolvedValue({ evaluated: 3, created: 2 });
    const res = response();
    await scheduledEscalationsHandler({ path: "/api/scheduled/warehouse-escalations" } as any, res as any);
    expect(runOperationalEscalationSweep).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ ok: true, taskUid: "cron_warehouse", evaluated: 3, created: 2 });
  });
});
