import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const getDb = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getDb }));
const { warehouseRouter } = await import("./routers/warehouse");

function contextFor(id: number): TrpcContext { return { user: { id, openId: `receipt-${id}`, name: "Mariam Hassan", email: "mariam@example.com", loginMethod: "supabase", role: "user", requestedRole: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] }; }
function invoiceQuery(invoice: unknown) { return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [invoice]) })) })) }; }

describe("digital handover receipt", () => {
  it("allows only the recorded receiver to confirm the invoice and records an audit activity", async () => {
    const invoice = { id: 7, invoiceNumber: "RT-HO-20260819-00007", receivedById: 4, requestId: 19, partId: 6, receiptConfirmedAt: null };
    const updateWhere = vi.fn(async () => undefined); const updateSet = vi.fn(() => ({ where: updateWhere })); const activityValues = vi.fn(async () => undefined);
    const tx = { select: vi.fn(() => invoiceQuery(invoice)), update: vi.fn(() => ({ set: updateSet })), insert: vi.fn(() => ({ values: activityValues })) };
    getDb.mockResolvedValue({ transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) });
    const result = await warehouseRouter.createCaller(contextFor(4)).invoices.confirmReceipt({ invoiceId: 7, confirmationName: "مريم حسن", receiptNote: "تم الاستلام بحالة سليمة." });
    expect(result.success).toBe(true);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ receiptConfirmationName: "مريم حسن", receiptNote: "تم الاستلام بحالة سليمة.", receiptConfirmedAt: expect.any(Date) }));
    expect(activityValues).toHaveBeenCalledWith(expect.objectContaining({ type: "handover_receipt_confirmed", actorId: 4, requestId: 19, partId: 6 }));
  });

  it("rejects receipt confirmation from a user other than the recorded receiver", async () => {
    const invoice = { id: 7, invoiceNumber: "RT-HO-20260819-00007", receivedById: 4, requestId: 19, partId: 6, receiptConfirmedAt: null };
    const tx = { select: vi.fn(() => invoiceQuery(invoice)), update: vi.fn(), insert: vi.fn() };
    getDb.mockResolvedValue({ transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) });
    await expect(warehouseRouter.createCaller(contextFor(5)).invoices.confirmReceipt({ invoiceId: 7, confirmationName: "مستخدم آخر" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
