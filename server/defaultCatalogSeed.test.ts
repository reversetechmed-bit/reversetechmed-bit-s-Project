import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("default warehouse catalog seed", () => {
  it("is idempotent, non-destructive, and includes all Target phototherapy editions with BOM links", () => {
    const sql = readFileSync(new URL("../scripts/seed-default-catalog.sql", import.meta.url), "utf8");
    expect(sql).toContain("ON DUPLICATE KEY UPDATE");
    expect(sql).not.toMatch(/\bDELETE\b|\bDROP\b|\bTRUNCATE\b/i);
    expect(sql.match(/TGT-PHOTO-(LITE-V1|PLUS-V2|PRO-V3)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(sql).toContain("RT-PRD-PHOTO-CONTROL");
    expect(sql).toContain("TGT-PRO-DEMO-001");
    expect(sql).toContain("REVERSE TECH");
    expect(sql).toContain("Target");
  });
});
