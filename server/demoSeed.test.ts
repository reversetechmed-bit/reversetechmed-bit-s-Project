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

  it("includes the approved REVERSE TECH roster as employee profiles without seeding credentials", () => {
    expect(seedSource).toContain("Eng Hamada Mohamed");
    expect(seedSource).toContain("Eng Mostafa Mabrouk");
    expect(seedSource).toContain("Eng Mohamed Ali");
    expect(seedSource).toContain("Eng Abdelalieem Ahmed");
    expect(seedSource).toContain("Eng Ibrahim Eldesouky");
    expect(seedSource).toContain("Sh. Abdelmon'em Eldesouky");
    expect(seedSource).not.toMatch(/password|auth\.users|INSERT INTO users/i);
  });
});
