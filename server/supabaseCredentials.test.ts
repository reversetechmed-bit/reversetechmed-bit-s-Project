import { describe, expect, it } from "vitest";

describe("Supabase configuration", () => {
  it("contains a valid project URL and a configured public key", () => {
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    expect(url).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(anonKey).toBeTruthy();

    expect((anonKey as string).length).toBeGreaterThan(20);
  });
});
