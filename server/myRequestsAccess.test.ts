import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const getDb = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getDb }));
const { warehouseRouter } = await import("./routers/warehouse");

function contextFor(role: "admin" | "user", id = 7): TrpcContext {
  return { user: { id, openId: `${role}-${id}`, name: role, email: `${role}-${id}@reversetech.com`, loginMethod: "supabase", role, requestedRole: role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function requestQuery(result: unknown[]) {
  const query = { innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue({ orderBy: vi.fn(async () => result) });
  query.orderBy.mockResolvedValue(result);
  return query;
}

describe("My Requests procedure access", () => {
  beforeEach(() => { getDb.mockReset(); });

  it("scopes a normal user's request list with the requester predicate", async () => {
    const result = [{ request: { id: 3, requestedById: 7 }, part: { name: "ABS Filament" }, engineer: { id: 7, name: "user" } }];
    const query = requestQuery(result);
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => query) })) });
    await expect(warehouseRouter.createCaller(contextFor("user", 7)).requests.list()).resolves.toEqual(result);
    expect(query.where).toHaveBeenCalledTimes(1);
  });

  it("leaves the request list unscoped for an admin queue", async () => {
    const result = [{ request: { id: 3, requestedById: 7 }, part: { name: "ABS Filament" }, engineer: { id: 7, name: "user" } }, { request: { id: 4, requestedById: 8 }, part: { name: "Pressure sensor" }, engineer: { id: 8, name: "another user" } }];
    const query = requestQuery(result);
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => query) })) });
    await expect(warehouseRouter.createCaller(contextFor("admin", 1)).requests.list()).resolves.toEqual(result);
    expect(query.where).not.toHaveBeenCalled();
  });

  it("scopes a user's invoice register to their own receiving user ID", async () => {
    const invoices = [{ invoice: { id: 11, requestId: 3, receivedById: 7, invoiceNumber: "RT-HO-00011" }, receiver: { id: 7, name: "user", email: "user-7@reversetech.com" } }];
    const orderBy = vi.fn(() => ({ limit: vi.fn(async () => invoices) }));
    const where = vi.fn(() => ({ orderBy }));
    const join = vi.fn(() => ({ where }));
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: join })) })) });
    await expect(warehouseRouter.createCaller(contextFor("user", 7)).invoices.mine()).resolves.toEqual(invoices);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("refuses a direct handover invoice lookup for a different receiving user", async () => {
    const foreignInvoice = { invoice: { id: 15, requestId: 6, receivedById: 9, invoiceNumber: "RT-HO-00015" }, receiver: { id: 9, name: "other", email: "other@reversetech.com" } };
    const limit = vi.fn(async () => [foreignInvoice]);
    const where = vi.fn(() => ({ limit }));
    const join = vi.fn(() => ({ where }));
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: join })) })) });
    await expect(warehouseRouter.createCaller(contextFor("user", 7)).invoices.byRequest({ requestId: 6 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
