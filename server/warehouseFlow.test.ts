import { describe, expect, it } from "vitest";
import { departmentInput, employeeInput, organizationRouter } from "./routers/organization";
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
      warehouseSection: "components",
      quantity: 3,
      minimumStock: 1,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an engineer attempting to access the company departments directory", async () => {
    const caller = organizationRouter.createCaller(contextFor("user"));
    await expect(caller.departments.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects any warehouse section other than components or products before a database write", async () => {
    const caller = warehouseRouter.createCaller(contextFor("admin"));
    await expect(caller.inventory.create({
      partNumber: "TEST-SECTION-01",
      name: "Section validation sample",
      category: "Electronics",
      warehouseSection: "invalid" as never,
      quantity: 3,
      minimumStock: 1,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates the department and employee data required for directory creation", () => {
    expect(departmentInput.parse({ name: "Embedded Systems", code: "EMB-01", description: "Firmware and hardware design" })).toMatchObject({ code: "EMB-01" });
    expect(departmentInput.parse({ name: "معمل الطباعة", code: "طباعة 3D" })).toMatchObject({ code: "طباعة 3D" });
    expect(employeeInput.parse({ fullName: "Rana Salem", email: "rana@example.com", employeeCode: "RT-102", jobTitle: "Embedded Engineer", departmentId: null, warehouseRole: "engineer" })).toMatchObject({ warehouseRole: "engineer" });
    expect(employeeInput.parse({ fullName: "سارة أحمد", email: "sara@example.com", employeeCode: "موظف ١", jobTitle: "مهندسة", departmentId: null, warehouseRole: "engineer" })).toMatchObject({ employeeCode: "موظف ١" });
    expect(() => employeeInput.parse({ fullName: "Rana Salem", email: "invalid-email", employeeCode: "RT-102", jobTitle: "Embedded Engineer", warehouseRole: "engineer" })).toThrow();
  });
});

describe("confirmed delivery persistence plan", () => {
  it("produces stock deduction, immutable transaction data, and a low-stock alert flag together", () => {
    const deliveryTime = new Date("2026-08-18T12:00:00.000Z");
    const movement = prepareConfirmedDelivery({
      request: { id: 21, status: "approved", requestedQuantity: 4, requestedById: 8, purpose: "Prototype verification" },
      part: { id: 5, partNumber: "EC-555", name: "Precision regulator", warehouseSection: "components", quantity: 6, reservedQuantity: 4, minimumStock: 3 },
      engineer: { id: 8, name: "Mariam Hassan" },
    }, 2, deliveryTime);

    expect(movement).toMatchObject({
      ok: true,
      quantityAfter: 2,
      reservedQuantityAfter: 0,
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
        warehouseSectionSnapshot: "components",
        details: "تم التسليم الفعلي لعدد 4 وحدة إلى Mariam Hassan.",
      },
    });
  });

  it("refuses delivery if an approved request no longer has its requested quantity reserved", () => {
    const movement = prepareConfirmedDelivery({
      request: { id: 22, status: "approved", requestedQuantity: 4, requestedById: 8, purpose: "Reservation integrity test" },
      part: { id: 6, partNumber: "EC-556", name: "Reserved regulator", warehouseSection: "components", quantity: 12, reservedQuantity: 2, minimumStock: 3 },
      engineer: { id: 8, name: "Mariam Hassan" },
    }, 2);

    expect(movement).toEqual({ ok: false, reason: "The quantity reserved for this approved request is no longer sufficient for delivery." });
  });

  it("executes the same delivery service used by the router to deduct stock, log the movement, and create a low-stock alert", async () => {
    const calls: Array<{ operation: string; payload: unknown }> = [];
    const outcome = await executeConfirmedDelivery({
      request: { id: 31, status: "approved", requestedQuantity: 3, requestedById: 7, purpose: "Pressure calibration" },
      part: { id: 9, partNumber: "MD-009", name: "Pressure sensor", warehouseSection: "products", quantity: 5, reservedQuantity: 3, minimumStock: 4 },
      engineer: { id: 7, name: "Omar Adel" },
    }, 1, {
      updatePartInventory: async (partId, inventory) => { calls.push({ operation: "updatePartInventory", payload: { partId, inventory } }); },
      markRequestDelivered: async (requestId, adminId, deliveredAt) => { calls.push({ operation: "markRequestDelivered", payload: { requestId, adminId, deliveredAt } }); },
      insertTransaction: async transaction => { calls.push({ operation: "insertTransaction", payload: transaction }); },
      createHandoverInvoice: async invoice => { calls.push({ operation: "createHandoverInvoice", payload: invoice }); },
      recordActivity: async activity => { calls.push({ operation: "recordActivity", payload: activity }); },
      hasUnreadLowStockAlert: async partId => { calls.push({ operation: "hasUnreadLowStockAlert", payload: partId }); return false; },
      createLowStockAlert: async alert => { calls.push({ operation: "createLowStockAlert", payload: alert }); },
    }, new Date("2026-08-18T12:00:00.000Z"));

    expect(outcome).toMatchObject({ ok: true, quantityAfter: 2, reservedQuantityAfter: 0, shouldCreateLowStockAlert: true });
    expect(calls).toEqual([
      { operation: "updatePartInventory", payload: { partId: 9, inventory: { quantity: 2, reservedQuantity: 0 } } },
      { operation: "markRequestDelivered", payload: { requestId: 31, adminId: 1, deliveredAt: new Date("2026-08-18T12:00:00.000Z") } },
      { operation: "insertTransaction", payload: expect.objectContaining({ type: "delivery_confirmed", quantityDelta: -3, quantityBefore: 5, quantityAfter: 2, engineerId: 7 }) },
      { operation: "createHandoverInvoice", payload: expect.objectContaining({ invoiceNumber: "RT-HO-20260818-00031", requestId: 31, partId: 9, receivedById: 7, quantity: 3, purposeSnapshot: "Pressure calibration" }) },
      { operation: "recordActivity", payload: expect.objectContaining({ type: "handover_completed", actorId: 1, requestId: 31, partId: 9 }) },
      { operation: "hasUnreadLowStockAlert", payload: 9 },
      { operation: "createLowStockAlert", payload: { type: "low_stock", title: "المنتجات: تنبيه مخزون منخفض", body: "وصلت كمية Pressure sensor في المنتجات إلى الحد الأدنى أو انخفضت عنه بعد التسليم.", partId: 9, requestId: 31 } },
    ]);
  });
});
