import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mockGetDb = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getDb: mockGetDb }));

const { warehouseRouter } = await import("./routers/warehouse");

function contextFor(userId: number, role: "admin" | "user"): TrpcContext {
  return { user: { id: userId, openId: `alert-${userId}`, name: "Test User", email: `user${userId}@reversetech.com`, loginMethod: "supabase", role, requestedRole: role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("warehouse notification privacy", () => {
  it("returns operational alerts through the Admin list and personal alerts through the user list", async () => {
    const adminLimit = vi.fn(async () => [{ id: 1, type: "new_request", recipientUserId: null }]);
    const adminOrderBy = vi.fn(() => ({ limit: adminLimit }));
    const adminWhere = vi.fn(() => ({ orderBy: adminOrderBy }));
    const adminFrom = vi.fn(() => ({ where: adminWhere, orderBy: adminOrderBy }));
    mockGetDb.mockResolvedValue({ select: vi.fn(() => ({ from: adminFrom })) });
    await expect(warehouseRouter.createCaller(contextFor(1, "admin")).alerts.list()).resolves.toEqual([{ id: 1, type: "new_request", recipientUserId: null }]);
    expect(adminWhere).toHaveBeenCalledTimes(1);

    const userLimit = vi.fn(async () => [{ id: 2, type: "request_approved", recipientUserId: 7 }]);
    const userOrderBy = vi.fn(() => ({ limit: userLimit }));
    const userWhere = vi.fn(() => ({ orderBy: userOrderBy }));
    const userFrom = vi.fn(() => ({ where: userWhere, orderBy: userOrderBy }));
    mockGetDb.mockResolvedValue({ select: vi.fn(() => ({ from: userFrom })) });
    await expect(warehouseRouter.createCaller(contextFor(7, "user")).alerts.list()).resolves.toEqual([{ id: 2, type: "request_approved", recipientUserId: 7 }]);
    expect(userWhere).toHaveBeenCalledTimes(1);
  });

  it("prevents a user from marking another recipient's notification as read", async () => {
    mockGetDb.mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 15, recipientUserId: 2, isRead: 0 }]) })) })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    });
    const caller = warehouseRouter.createCaller(contextFor(1, "user"));
    await expect(caller.alerts.markRead({ id: 15 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
