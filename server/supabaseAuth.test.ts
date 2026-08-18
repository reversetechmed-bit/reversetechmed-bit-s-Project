import { describe, expect, it } from "vitest";
import { getSupabaseAccessToken, isSupabaseAccount } from "./supabaseAuth";

describe("Supabase session authorization", () => {
  it("extracts only valid bearer access tokens from tRPC request headers", () => {
    expect(getSupabaseAccessToken("Bearer session-token-123")).toBe("session-token-123");
    expect(getSupabaseAccessToken("Basic session-token-123")).toBeNull();
    expect(getSupabaseAccessToken("Bearer ")).toBeNull();
    expect(getSupabaseAccessToken(undefined)).toBeNull();
  });

  it("accepts only Supabase account responses with a usable identity and email", () => {
    expect(isSupabaseAccount({ id: "7d909fd9-6a34-4a31-bccc-a7cc58b1a699", email: "admin@reversetech.com" })).toBe(true);
    expect(isSupabaseAccount({ id: "7d909fd9-6a34-4a31-bccc-a7cc58b1a699", email: "not-an-email" })).toBe(false);
    expect(isSupabaseAccount({ id: "", email: "admin@reversetech.com" })).toBe(false);
  });
});
