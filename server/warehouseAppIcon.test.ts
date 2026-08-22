import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appRoot = new URL("../", import.meta.url);
const iconPath = "/manus-storage/reverse-tech-warehouse-icon_33f2d6a3.png";

describe("warehouse application icon", () => {
  it("uses the supplied warehouse icon for browser and mobile application identity", () => {
    const index = readFileSync(new URL("client/index.html", appRoot), "utf8");
    const manifest = readFileSync(new URL("client/public/manifest.webmanifest", appRoot), "utf8");
    expect(index).toContain(`<link rel="icon" type="image/png" href="${iconPath}" />`);
    expect(index).toContain(`<link rel="apple-touch-icon" href="${iconPath}" />`);
    expect(index).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(manifest).toContain(iconPath);
    expect(manifest).toContain('"display": "standalone"');
  });

  it("renders the warehouse icon in both compact sidebar and mobile header identities", () => {
    const layout = readFileSync(new URL("client/src/components/DashboardLayout.tsx", appRoot), "utf8");
    expect(layout).toContain(`const WAREHOUSE_APP_ICON = "${iconPath}"`);
    expect(layout).toContain('alt="أيقونة مخزن REVERSE TECH"');
    expect(layout).toContain('alt="أيقونة المخزن"');
  });
});
