import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notification role split and sound control", () => {
  it("limits the Admin notification list to operational alerts without a recipient", () => {
    const source = readFileSync(new URL("./routers/warehouse.ts", import.meta.url), "utf8");
    expect(source).toContain("isNull(warehouseAlerts.recipientUserId)");
    expect(source).toContain("and(eq(warehouseAlerts.isRead, 0), isNull(warehouseAlerts.recipientUserId))");
  });

  it("labels notification scopes and provides an opt-in browser sound control", () => {
    const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
    expect(source).toContain("تنبيهات إدارة المخزن");
    expect(source).toContain("تنبيهات طلباتي");
    expect(source).toContain("reverse-tech-notification-sound");
    expect(source).toContain("playNotificationTone");
    expect(source).toContain("refetchInterval: 15_000");
    expect(source).toContain("refetchIntervalInBackground: false");
  });
});
