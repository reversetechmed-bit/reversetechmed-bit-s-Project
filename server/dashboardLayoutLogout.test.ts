import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard account switch controls", () => {
  const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

  it("renders a direct logout and account-switch action in the desktop sidebar", () => {
    expect(source).toContain("تسجيل الخروج وتبديل الحساب");
    expect(source).toContain('onClick={switchAccount}');
    expect(source).toContain('window.location.replace("/")');
  });

  it("keeps a visible mobile logout action when sidebar navigation is unavailable", () => {
    expect(source).toContain('md:hidden');
    expect(source).toContain('aria-label="تسجيل الخروج وتبديل الحساب"');
  });

  it("does not wait for an account query refresh before allowing the switch-account redirect", () => {
    const authSource = readFileSync(new URL("../client/src/_core/hooks/useAuth.ts", import.meta.url), "utf8");
    expect(authSource).toContain("trpc.auth.logout.useMutation()");
    expect(authSource).toContain("await legacyLogout.mutateAsync().catch(() => null)");
    expect(authSource).toContain('supabase.auth.signOut({ scope: "local" })');
    expect(authSource).toContain("void utils.auth.me.invalidate()");
    expect(authSource).not.toContain("await utils.auth.me.invalidate()");
  });
});
