import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mockGetDb = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getDb: mockGetDb }));

const { warehouseRouter } = await import("./routers/warehouse");

function contextFor(userId: number, role: "admin" | "user"): TrpcContext {
  return { user: { id: userId, openId: `alert-${userId}`, name: "Test User", email: `user${userId}@reversetech.com`, loginMethod: "supabase", role, requestedRole: role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("warehouse notification privacy", () => {
  it("prevents a user from marking another recipient's notification as read", async () => {
    mockGetDb.mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 15, recipientUserId: 2, isRead: 0 }]) })) })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    });
    const caller = warehouseRouter.createCaller(contextFor(1, "user"));
    await expect(caller.alerts.markRead({ id: 15 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
