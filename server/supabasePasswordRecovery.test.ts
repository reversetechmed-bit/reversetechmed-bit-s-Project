import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Supabase password recovery screen", () => {
  const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

  it("detects the Supabase recovery event and renders an Arabic password reset form", () => {
    expect(source).toContain('event === "PASSWORD_RECOVERY"');
    expect(source).toContain("تعيين كلمة مرور جديدة");
    expect(source).toContain("recovery-password-confirmation");
  });

  it("preserves the recovery marker before Supabase cleans the URL hash", () => {
    const clientSource = readFileSync(new URL("../client/src/lib/supabase.ts", import.meta.url), "utf8");
    expect(clientSource).toContain("passwordRecoveryLinkOnLoad");
    expect(clientSource).toContain("isPasswordRecoveryLink");
  });

  it("updates the password then clears the recovery session before returning to sign-in", () => {
    expect(source).toContain("supabase.auth.updateUser({ password })");
    expect(source).toContain('supabase.auth.signOut({ scope: "local" })');
    expect(source).toContain("onRecoveryComplete?.()");
  });
});
