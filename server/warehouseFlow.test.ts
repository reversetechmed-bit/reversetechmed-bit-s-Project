import { describe, expect, it } from "vitest";
import { warehouseRouter } from "./routers/warehouse";
import { executeConfirmedDelivery, prepareConfirmedDelivery } from "./warehouseDelivery";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 44,
      openId: `test-${role}`,
      name: "Test Engineer",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("warehouse procedure permissions", () => {
  it("rejects an admin attempting to submit an engineer dispensing request", async () => {
    const caller = warehouseRouter.createCaller(contextFor("admin"));
    await expect(caller.requests.create({ partId: 1, requestedQuantity: 1, purpose: "Prototype verification" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an engineer attempting to create an inventory record", async () => {
    const caller = warehouseRouter.createCaller(contextFor("user"));
    await expect(caller.inventory.create({
      partNumber: "TEST-001",
      name: "Protected Part",
      category: "Electronics",
      quantity: 3,
      minimumStock: 1,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("confirmed delivery persistence plan", () => {
  it("produces stock deduction, immutable transaction data, and a low-stock alert flag together", () => {
    const deliveryTime = new Date("2026-08-18T12:00:00.000Z");
    const movement = prepareConfirmedDelivery({
      request: { id: 21, status: "approved", requestedQuantity: 4, requestedById: 8 },
      part: { id: 5, partNumber: "EC-555", name: "Precision regulator", quantity: 6, minimumStock: 3 },
      engineer: { id: 8, name: "Mariam Hassan" },
    }, 2, deliveryTime);

    expect(movement).toMatchObject({
      ok: true,
      quantityAfter: 2,
      deliveredAt: deliveryTime,
      shouldCreateLowStockAlert: true,
      transaction: {
        partId: 5,
        requestId: 21,
        type: "delivery_confirmed",
        quantityDelta: -4,
        quantityBefore: 6,
        quantityAfter: 2,
        actorId: 2,
        engineerId: 8,
        partNumberSnapshot: "EC-555",
        partNameSnapshot: "Precision regulator",
        details: "Physically handed over 4 unit(s) to Mariam Hassan.",
      },
    });
  });

  it("executes the same delivery service used by the router to deduct stock, log the movement, and create a low-stock alert", async () => {
    const calls: Array<{ operation: string; payload: unknown }> = [];
    const outcome = await executeConfirmedDelivery({
      request: { id: 31, status: "approved", requestedQuantity: 3, requestedById: 7 },
      part: { id: 9, partNumber: "MD-009", name: "Pressure sensor", quantity: 5, minimumStock: 4 },
      engineer: { id: 7, name: "Omar Adel" },
    }, 1, {
      updatePartQuantity: async (partId, quantity) => { calls.push({ operation: "updatePartQuantity", payload: { partId, quantity } }); },
      markRequestDelivered: async (requestId, adminId, deliveredAt) => { calls.push({ operation: "markRequestDelivered", payload: { requestId, adminId, deliveredAt } }); },
      insertTransaction: async transaction => { calls.push({ operation: "insertTransaction", payload: transaction }); },
      hasUnreadLowStockAlert: async partId => { calls.push({ operation: "hasUnreadLowStockAlert", payload: partId }); return false; },
      createLowStockAlert: async alert => { calls.push({ operation: "createLowStockAlert", payload: alert }); },
    }, new Date("2026-08-18T12:00:00.000Z"));

    expect(outcome).toMatchObject({ ok: true, quantityAfter: 2, shouldCreateLowStockAlert: true });
    expect(calls).toEqual([
      { operation: "updatePartQuantity", payload: { partId: 9, quantity: 2 } },
      { operation: "markRequestDelivered", payload: { requestId: 31, adminId: 1, deliveredAt: new Date("2026-08-18T12:00:00.000Z") } },
      { operation: "insertTransaction", payload: expect.objectContaining({ type: "delivery_confirmed", quantityDelta: -3, quantityBefore: 5, quantityAfter: 2, engineerId: 7 }) },
      { operation: "hasUnreadLowStockAlert", payload: 9 },
      { operation: "createLowStockAlert", payload: { type: "low_stock", title: "Low stock warning", body: "Pressure sensor is below its minimum stock threshold after delivery.", partId: 9, requestId: 31 } },
    ]);
  });
});
