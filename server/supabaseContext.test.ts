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

  it("creates a user only for an eligible active employee and copies the employee identity and role", async () => {
    const select = selectQueue(
      [],
      [{ id: 4, fullName: "Eng Abdelalieem Ahmed", warehouseRole: "admin", isActive: 1, userId: null }],
      [{ id: 23, openId: "supabase-user-id", name: "Eng Abdelalieem Ahmed", email: "admin@reversetech.com", loginMethod: "supabase", role: "admin", requestedRole: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }],
    );
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) }));
    const insertValues = vi.fn(async () => undefined);
    const insert = vi.fn(() => ({ values: insertValues }));
    mocks.getDb.mockResolvedValue({ select, update, insert });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ id: "supabase-user-id", email: "admin@reversetech.com", user_metadata: { full_name: "Untrusted Name", requested_role: "user" } }) })));

    const context = await createContext({ req: { headers: { authorization: "Bearer signed-session-token" } }, res: {} } as never);

    expect(context.user).toMatchObject({ id: 23, role: "admin", email: "admin@reversetech.com" });
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ name: "Eng Abdelalieem Ahmed", requestedRole: "admin", role: "admin" }));
    expect(update).toHaveBeenCalled();
    expect(mocks.authenticateRequest).not.toHaveBeenCalled();
  });

  it("refreshes an existing account from its linked employee profile instead of Supabase metadata", async () => {
    const existing = { id: 23, openId: "supabase-existing-user", name: "Existing User", email: "existing@reversetech.com", loginMethod: "supabase", role: "user", requestedRole: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    const select = selectQueue([existing], [{ id: 7, fullName: "Eng Ibrahim Eldesouky", warehouseRole: "admin", isActive: 1, userId: 23 }], [{ ...existing, name: "Eng Ibrahim Eldesouky", role: "admin", requestedRole: "admin" }]);
    const updateSet = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    const update = vi.fn(() => ({ set: updateSet }));
    mocks.getDb.mockResolvedValue({ select, update, insert: vi.fn() });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ id: "supabase-existing-user", email: "existing@reversetech.com", user_metadata: { requested_role: "user" } }) })));

    const context = await createContext({ req: { headers: { authorization: "Bearer signed-session-token" } }, res: {} } as never);

    expect(context.user).toMatchObject({ id: 23, name: "Eng Ibrahim Eldesouky", role: "admin", requestedRole: "admin" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ name: "Eng Ibrahim Eldesouky", role: "admin", requestedRole: "admin" }));
  });

  it("does not create an internal warehouse user for a Supabase account without an approved employee profile", async () => {
    const select = selectQueue([], []);
    const insert = vi.fn();
    mocks.getDb.mockResolvedValue({ select, update: vi.fn(), insert });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ id: "outside-account", email: "outside@example.com", user_metadata: {} }) })));
    const context = await createContext({ req: { headers: { authorization: "Bearer signed-session-token" } }, res: {} } as never);
    expect(context.user).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns an unauthenticated context when there is no bearer token and no legacy session", async () => {
    const context = await createContext({ req: { headers: {} }, res: {} } as never);
    expect(context.user).toBeNull();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.authenticateRequest).toHaveBeenCalled();
  });
});
