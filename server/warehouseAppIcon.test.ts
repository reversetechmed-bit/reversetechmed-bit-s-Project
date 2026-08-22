import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appRoot = new URL("../", import.meta.url);
const iconPath = "/manus-storage/reverse-tech-warehouse-icon-hq_0336c499.png";

describe("warehouse application icon", () => {
  it("uses the supplied warehouse icon for browser and mobile application identity", () => {
    const index = readFileSync(new URL("client/index.html", appRoot), "utf8");
    const manifest = readFileSync(new URL("client/public/manifest.webmanifest", appRoot), "utf8");
    expect(index).toContain(`<link rel="icon" type="image/png" href="${iconPath}" />`);
    expect(index).toContain(`<link rel="apple-touch-icon" sizes="1024x1024" href="${iconPath}" />`);
    expect(index).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(manifest).toContain(iconPath);
    expect(manifest).toContain('"display": "standalone"');
  });

  it("renders the warehouse icon in both compact sidebar and mobile header identities without the previous logo mark", () => {
    const layout = readFileSync(new URL("client/src/components/DashboardLayout.tsx", appRoot), "utf8");
    const home = readFileSync(new URL("client/src/pages/Home.tsx", appRoot), "utf8");
    expect(layout).toContain(`const WAREHOUSE_APP_ICON = "${iconPath}"`);
    expect(layout).toContain('alt="أيقونة مخزن REVERSE TECH"');
    expect(layout).toContain('alt="أيقونة المخزن"');
    expect(layout).not.toContain("reverse-tech-logo_04d48f19");
    expect(home).toContain(iconPath);
    expect(home).not.toContain("reverse-tech-logo_04d48f19");
  });
});
