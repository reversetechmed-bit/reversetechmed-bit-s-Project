import { describe, expect, it } from "vitest";
import { createsProductBomCycle } from "./productBomRules";

describe("nested product BOM rules", () => {
  it("allows a board under development to be a source for a finished device", () => {
    expect(createsProductBomCycle(30, [20], [{ productId: 20, componentId: 10 }])).toBe(false);
  });

  it("rejects direct and indirect board-to-device cycles", () => {
    expect(createsProductBomCycle(20, [20], [])).toBe(true);
    expect(createsProductBomCycle(20, [30], [{ productId: 30, componentId: 20 }])).toBe(true);
  });
});
