import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const responses = vi.hoisted(() => [] as unknown[]);
const mockGetDb = vi.hoisted(() => vi.fn());
const inserted = vi.hoisted(() => [] as Record<string, unknown>[]);

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  query.from = vi.fn(() => query);
  query.where = vi.fn(() => query);
  query.orderBy = vi.fn(() => query);
  query.limit = vi.fn(async () => result);
  query.then = (onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) => Promise.resolve(result).then(onfulfilled, onrejected);
  return query;
}

const db = {
  select: vi.fn(() => responses.shift()),
  insert: vi.fn(() => ({ values: vi.fn(async (values: Record<string, unknown>) => { inserted.push(values); }) })),
};

vi.mock("./db", () => ({ getDb: mockGetDb }));

const { organizationRouter } = await import("./routers/organization");

function contextFor(role: "admin" | "user"): TrpcContext {
  return {
    user: { id: 1, openId: `company-${role}`, name: "Warehouse User", email: "warehouse@example.com", loginMethod: "supabase", role, requestedRole: role, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("company directory procedures", () => {
  beforeEach(() => {
    responses.length = 0;
    inserted.length = 0;
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(db);
  });

  it("permits company directory actions only to an Admin", async () => {
    const caller = organizationRouter.createCaller(contextFor("user"));
    await expect(caller.companies.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.companies.create({ name: "Reverse Medical", code: "REV-MED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates and lists a company record with optional contact data preserved", async () => {
    const company = { id: 12, name: "Reverse Medical", code: "REV-MED", contactName: "Operations", contactEmail: "ops@example.com", isActive: 1 };
    responses.push(chain([company]));
    const caller = organizationRouter.createCaller(contextFor("admin"));
    const created = await caller.companies.create({ name: "Reverse Medical", code: "REV-MED", contactName: "Operations", contactEmail: "ops@example.com" });
    expect(created).toEqual(company);
    expect(inserted[0]).toMatchObject({ name: "Reverse Medical", code: "REV-MED", contactName: "Operations", contactEmail: "ops@example.com", createdById: 1 });

    responses.push(chain([company]));
    await expect(caller.companies.list()).resolves.toEqual([company]);
  });
});
