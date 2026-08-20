import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

describe("classic authentication screen presentation", () => {
  it("keeps the operational identifier, internal-operations divider, and bronze primary action", () => {
    expect(layoutSource).toContain("RT · WMS · 01");
    expect(layoutSource).toContain("بوابة العمليات الداخلية");
    expect(layoutSource).toContain("bg-[#a97937]");
    expect(layoutSource).toContain("shadow-[0_5px_0_#7a5528]");
  });
});
