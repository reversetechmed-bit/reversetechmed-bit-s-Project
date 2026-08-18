import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  authenticateRequest: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));

const { createContext } = await import("./_core/context");

function selectQueue(...responses: unknown[][]) {
  const queue = [...responses];
  return vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: vi.fn(async () => queue.shift() ?? []) })),
    })),
  }));
}

describe("Supabase-backed tRPC context", () => {
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.VITE_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "public-test-key-long-enough";
    mocks.getDb.mockReset();
    mocks.authenticateRequest.mockReset().mockRejectedValue(new Error("No legacy session"));
  });

  afterEach(() => {
    process.env.VITE_SUPABASE_URL = originalUrl;
    process.env.VITE_SUPABASE_ANON_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("maps a valid Supabase bearer session to an employee-backed local admin user", async () => {
    const select = selectQueue(
      [],
      [{ id: 5, email: "admin@reversetech.com", warehouseRole: "admin", userId: null }],
      [],
      [{ id: 23, openId: "supabase-user-id", name: "Reverse Admin", email: "admin@reversetech.com", loginMethod: "supabase", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }],
    );
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) }));
    const insertValues = vi.fn(async () => undefined);
    const insert = vi.fn(() => ({ values: insertValues }));
    mocks.getDb.mockResolvedValue({ select, update, insert });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ id: "supabase-user-id", email: "admin@reversetech.com", user_metadata: { full_name: "Reverse Admin", requested_role: "admin" } }) })));

    const context = await createContext({ req: { headers: { authorization: "Bearer signed-session-token" } }, res: {} } as never);

    expect(context.user).toMatchObject({ id: 23, role: "admin", email: "admin@reversetech.com" });
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ requestedRole: "admin", role: "admin" }));
    expect(update).toHaveBeenCalled();
    expect(mocks.authenticateRequest).not.toHaveBeenCalled();
  });

  it("returns an unauthenticated context when there is no bearer token and no legacy session", async () => {
    const context = await createContext({ req: { headers: {} }, res: {} } as never);
    expect(context.user).toBeNull();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.authenticateRequest).toHaveBeenCalled();
  });
});
