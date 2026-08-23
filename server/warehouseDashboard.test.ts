import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const getDb = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getDb }));
const { warehouseRouter } = await import("./routers/warehouse");

function chain(result: unknown[]) {
  const ordered = Object.assign(Promise.resolve(result), { limit: vi.fn(async () => result), orderBy: vi.fn(() => ordered), innerJoin: vi.fn(() => ordered), leftJoin: vi.fn(() => ordered) });
  const orderedQuery = vi.fn(() => ordered);
  return { from: vi.fn(() => ({ orderBy: orderedQuery, where: vi.fn(() => ({ orderBy: orderedQuery })), leftJoin: vi.fn(() => ordered), innerJoin: vi.fn(() => ordered) })) };
}
function adminContext(): TrpcContext { return { user: { id: 1, openId: "dash-admin", name: "Admin", email: "admin@reversetech.com", loginMethod: "supabase", role: "admin", requestedRole: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

describe("warehouse dashboard output", () => {
  it("returns recent warehouse activity and most recent user access alongside stock summaries", async () => {
    const activities = [{ activity: { id: 11, title: "Handover confirmed", detail: "ABS Filament delivered", createdAt: new Date() }, actor: { id: 4, name: "Warehouse Admin", email: "admin@reversetech.com" } }];
    const recentAccess = [{ id: 7, name: "Sara Ahmed", email: "sara@reversetech.com", role: "user", lastSignedIn: new Date() }];
    const selects = [chain([{ id: 1, warehouseSection: "components", quantity: 2, reservedQuantity: 0, minimumStock: 3 }, { id: 2, warehouseSection: "products", quantity: 8, reservedQuantity: 0, minimumStock: 2 }]), chain([{ status: "pending", createdAt: new Date() }, { status: "delivered", createdAt: new Date() }]), chain([{ id: 5, type: "low_stock" }]), chain(activities), chain(recentAccess), chain([]), chain([]), chain([{ status: "in_progress" }]), chain([{ line: { varianceQuantity: 2 }, session: { id: 9, status: "approved", createdAt: new Date() } }])];
    getDb.mockResolvedValue({ select: vi.fn(() => selects.shift()) });
    const dashboard = await warehouseRouter.createCaller(adminContext()).dashboard();
    expect(dashboard).toMatchObject({ partCount: 2, totalUnits: 10, reservedUnits: 0, availableUnits: 10, componentCount: 1, productCount: 1, pendingRequests: 1, openWorkOrders: 1, currentCountVarianceLines: 1, currentCountVarianceSessions: 1, lowStockParts: [{ id: 1 }], unreadAlerts: [{ id: 5 }], topDispensedParts: [], recentHandovers: [] });
    expect(dashboard.recentActivities).toEqual(activities);
    expect(dashboard.recentAccess).toEqual(recentAccess);
  });
});
