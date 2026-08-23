import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const responses = vi.hoisted(() => [] as unknown[]);
const chain = (result: unknown) => {
  const query: Record<string, unknown> = {};
  query.from = vi.fn(() => query); query.innerJoin = vi.fn(() => query); query.where = vi.fn(() => query); query.orderBy = vi.fn(() => query);
  query.limit = vi.fn(async () => result); query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return query;
};
const transactionDb = { select: vi.fn(() => chain(responses.shift())), delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })), insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })) };
const db = { select: vi.fn(() => chain(responses.shift())), transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)) };
vi.mock("./db", () => ({ getDb: vi.fn(async () => db) }));
const { organizationRouter } = await import("./routers/organization");
const contextFor = (role: "admin" | "user"): TrpcContext => ({ user: { id: 1, openId: `bom-${role}`, name: "Warehouse User", email: "warehouse@example.com", loginMethod: "supabase", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });

describe("product component catalog", () => {
  beforeEach(() => { responses.length = 0; vi.clearAllMocks(); });
  it("does not expose product component lists or replacements to normal users", async () => {
    const caller = organizationRouter.createCaller(contextFor("user"));
    await expect(caller.productComponents.list({ productId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.productComponents.replace({ productId: 12, components: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("lists component rows and replaces a product BOM only after validating a product and component records", async () => {
    responses.push([{ bom: { productId: 12, componentId: 4, quantityRequired: 2 }, component: { id: 4, name: "ESP32" } }]);
    const caller = organizationRouter.createCaller(contextFor("admin"));
    await expect(caller.productComponents.list({ productId: 12 })).resolves.toHaveLength(1);
    responses.push([{ id: 12, warehouseSection: "products" }], [{ id: 4, warehouseSection: "components", productStage: null }, { id: 5, warehouseSection: "products", productStage: "work_in_progress" }], []);
    await expect(caller.productComponents.replace({ productId: 12, components: [{ componentId: 4, quantityRequired: 2, notes: "رئيسي" }, { componentId: 5, quantityRequired: 1 }] })).resolves.toEqual({ success: true });
    expect(transactionDb.delete).toHaveBeenCalled();
    expect(transactionDb.insert).toHaveBeenCalled();
  });
  it("rejects duplicate components before any transaction is opened", async () => {
    const caller = organizationRouter.createCaller(contextFor("admin"));
    await expect(caller.productComponents.replace({ productId: 12, components: [{ componentId: 4, quantityRequired: 1 }, { componentId: 4, quantityRequired: 2 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
