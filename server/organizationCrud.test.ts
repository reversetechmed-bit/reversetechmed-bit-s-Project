import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = {
  insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 1 }]) })) })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
};

vi.mock("./db", () => ({ getDb: vi.fn(async () => db) }));

const { organizationRouter } = await import("./routers/organization");

function adminContext(): TrpcContext {
  return { user: { id: 1, openId: "admin-test", name: "Admin", email: "admin@reversetech.com", loginMethod: "supabase", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("organization CRUD procedures", () => {
  it("executes create, update, and archive mutations for departments", async () => {
    const caller = organizationRouter.createCaller(adminContext());
    await caller.departments.create({ name: "Medical Engineering", code: "MED-ENG" });
    await caller.departments.update({ id: 1, name: "Medical Engineering", code: "MED-ENG", description: "Clinical product design" });
    await caller.departments.archive({ id: 1 });
    expect(db.insert).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it("executes create, update, and archive mutations for employee profiles", async () => {
    const caller = organizationRouter.createCaller(adminContext());
    const employee = { fullName: "Mariam Hassan", email: "mariam@reversetech.com", employeeCode: "RT-110", jobTitle: "Embedded Engineer", departmentId: 1, warehouseRole: "engineer" as const };
    await caller.employees.create(employee);
    await caller.employees.update({ id: 1, ...employee, jobTitle: "Senior Embedded Engineer" });
    await caller.employees.archive({ id: 1 });
    expect(db.insert).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });
});
