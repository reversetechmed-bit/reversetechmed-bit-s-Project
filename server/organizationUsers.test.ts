import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const responses = vi.hoisted(() => [] as unknown[]);
const mockGetDb = vi.hoisted(() => vi.fn());

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  query.from = vi.fn(() => query);
  query.leftJoin = vi.fn(() => query);
  query.where = vi.fn(() => query);
  query.orderBy = vi.fn(() => query);
  query.limit = vi.fn(async () => result);
  query.then = (onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) => Promise.resolve(result).then(onfulfilled, onrejected);
  return query;
}

const db = {
  select: vi.fn(() => responses.shift()),
};

vi.mock("./db", () => ({ getDb: mockGetDb }));

const { organizationRouter } = await import("./routers/organization");

function contextFor(role: "admin" | "user"): TrpcContext {
  return {
    user: { id: 1, openId: `${role}-directory`, name: "Directory User", email: "directory@reversetech.com", loginMethod: "supabase", role, requestedRole: role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Admin user directory", () => {
  beforeEach(() => {
    responses.length = 0;
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(db);
  });

  it("does not expose account lists or detailed activity to a normal user", async () => {
    const caller = organizationRouter.createCaller(contextFor("user"));
    await expect(caller.users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.activity({ userId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns per-account request, handover, alert, transaction, and activity summaries to an Admin", async () => {
    const account = { id: 7, name: "Mariam Hassan", email: "mariam@reversetech.com", role: "user", lastSignedIn: new Date("2026-08-20T09:00:00Z") };
    responses.push(
      chain([{ account, employee: null, department: null }]),
      chain([{ requestedById: 7, status: "pending" }, { requestedById: 7, status: "delivered" }]),
      chain([{ receivedById: 7, issuedById: 1 }]),
      chain([{ actorId: 1, engineerId: 7 }]),
      chain([{ recipientUserId: 7, isRead: 0 }]),
      chain([{ actorId: 7, createdAt: new Date("2026-08-20T10:00:00Z") }]),
    );

    const result = await organizationRouter.createCaller(contextFor("admin")).users.list();
    expect(result).toHaveLength(1);
    expect(result[0]?.summary).toMatchObject({
      requestCount: 2,
      pendingRequestCount: 1,
      deliveredRequestCount: 1,
      receivedInvoiceCount: 1,
      transactionCount: 1,
      activityCount: 1,
      unreadAlertCount: 1,
    });
  });
});
