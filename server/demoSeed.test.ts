import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seedSource = readFileSync(new URL("../scripts/seed-demo.mjs", import.meta.url), "utf8");

describe("demo warehouse seed", () => {
  it("keeps the seed data explicitly marked and idempotent", () => {
    expect(seedSource).toContain('const DEMO_MARKER = "[بيانات تجريبية]"');
    expect(seedSource).toContain("await connection.beginTransaction()");
    expect(seedSource).toContain("await connection.commit()");
    expect(seedSource).toContain("insertOnce");
  });

  it("covers warehouse operations without fabricating authentication accounts or reviews", () => {
    expect(seedSource).toContain('"DEMO-REQ-PENDING"');
    expect(seedSource).toContain('"DEMO-REQ-APPROVED"');
    expect(seedSource).toContain('"DEMO-REQ-DELIVERED"');
    expect(seedSource).toContain('"DEMO-INV-0001"');
    expect(seedSource).not.toContain("INSERT INTO users");
    expect(seedSource).not.toMatch(/testimonial|rating/i);
  });
});
