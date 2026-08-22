import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Admin Users page wiring", () => {
  it("registers the Admin-only user directory route and sidebar entry", () => {
    const app = source("client/src/App.tsx");
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(app).toContain('path={"/users"}');
    expect(app).toContain("<Users />");
    expect(layout).toContain('label: "المستخدمون", path: "/users"');
  });

  it("requests a role-guarded list and selected-user activity record", () => {
    const page = source("client/src/pages/Users.tsx");
    expect(page).toContain("trpc.organization.users.list.useQuery");
    expect(page).toContain("trpc.organization.users.activity.useQuery");
    expect(page).toContain('user?.role !== "admin"');
    expect(page).toContain("تنبيهات شخصية");
    expect(page).toContain("حركات المخزون");
  });
});
