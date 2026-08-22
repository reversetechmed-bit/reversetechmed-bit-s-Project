import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TrpcContext } from "./_core/context";

const responses = vi.hoisted(() => [] as unknown[]);
const chain = (result: unknown) => {
  const query: Record<string, unknown> = {};
  query.from = vi.fn(() => query); query.where = vi.fn(() => query); query.limit = vi.fn(async () => result);
  return query;
};
const tx = { select: vi.fn(() => chain(responses.shift())), update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })) };
const db = { transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
vi.mock("./db", () => ({ getDb: vi.fn(async () => db) }));
const { organizationRouter } = await import("./routers/organization");
const context = (role: "admin" | "user"): TrpcContext => ({ user: { id: 1, openId: `employee-link-${role}`, name: "Manager", email: "manager@reverse.local", loginMethod: "supabase", role, requestedRole: role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });

describe("employee account linking", () => {
  beforeEach(() => { responses.length = 0; vi.clearAllMocks(); });

  it("lets only an Admin link an existing account to one active employee and synchronizes the employee identity", async () => {
    responses.push(
      [{ id: 8, isActive: 1, userId: null, fullName: "Eng Hamada Mohamed", warehouseRole: "engineer" }],
      [{ id: 22, email: "hamada@reverse.local" }],
      [],
    );
    await expect(organizationRouter.createCaller(context("admin")).employees.linkAccount({ employeeId: 8, userId: 22 })).resolves.toEqual({ success: true });
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it("does not allow a normal user to link accounts or inspect the employee relationship", async () => {
    await expect(organizationRouter.createCaller(context("user")).employees.linkAccount({ employeeId: 8, userId: 22 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("keeps sign-up bound to a selected employee and verified approved email or passcode instead of a free role", () => {
    const layout = readFileSync(resolve(import.meta.dirname, "../client/src/components/DashboardLayout.tsx"), "utf8");
    expect(layout).toContain("organization.enrollment.directory.useQuery");
    expect(layout).toContain("organization.enrollment.claim.useMutation");
    expect(layout).toContain("اختر اسمك من دليل الموظفين أولًا.");
    expect(layout).toContain("رمز التفعيل من الأدمن");
    expect(layout).not.toContain("auth-name");
    expect(layout).not.toContain("setRequestedRole");
  });
});
