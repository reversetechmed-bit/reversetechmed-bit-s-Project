import { describe, expect, it } from "vitest";
import {
  canDecideRequest,
  canEngineerSubmit,
  formatDeliveryDetails,
  isLowStock,
  mustScopeRequestsToRequester,
  validateDelivery,
} from "./warehouseRules";

describe("warehouse role rules", () => {
  it("allows an engineer account to submit a dispensing request but not an admin account", () => {
    expect(canEngineerSubmit("user")).toBe(true);
    expect(canEngineerSubmit("admin")).toBe(false);
  });

  it("only allows a pending request to be decided", () => {
    expect(canDecideRequest("pending")).toBe(true);
    expect(canDecideRequest("approved")).toBe(false);
    expect(canDecideRequest("rejected")).toBe(false);
    expect(canDecideRequest("delivered")).toBe(false);
  });

  it("scopes the My Requests feed to the signed-in requester unless the account is an admin", () => {
    expect(mustScopeRequestsToRequester("user")).toBe(true);
    expect(mustScopeRequestsToRequester("admin")).toBe(false);
  });
});

describe("warehouse delivery rules", () => {
  it("deducts the requested quantity only from an approved request with adequate stock", () => {
    expect(validateDelivery("approved", 12, 12, 5)).toEqual({ ok: true, quantityAfter: 7 });
  });

  it("blocks delivery for a request that has not been approved", () => {
    expect(validateDelivery("pending", 12, 5, 5)).toEqual({
      ok: false,
      reason: "Only approved requests can be confirmed as delivered.",
    });
  });

  it("blocks automatic deduction when current stock is insufficient", () => {
    expect(validateDelivery("approved", 2, 5, 5)).toEqual({
      ok: false,
      reason: "There is no longer enough inventory to deliver this request.",
    });
  });

  it("detects a low stock condition when quantity reaches or falls below the threshold", () => {
    expect(isLowStock(4, 5)).toBe(true);
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(8, 5)).toBe(false);
  });

  it("records the recipient in the delivery audit detail", () => {
    expect(formatDeliveryDetails(3, "Mariam Hassan")).toBe("Physically handed over 3 unit(s) to Mariam Hassan.");
  });
});
