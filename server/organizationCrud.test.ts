import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = {
  insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 1 }]) })) })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
  delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  transaction: vi.fn(async (callback) => callback(db)),
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

  it("executes create, update, and archive mutations for general component types", async () => {
    const caller = organizationRouter.createCaller(adminContext());
    await caller.componentTypes.create({ name: "3D Printing", description: "Filaments and print-lab materials" });
    await caller.componentTypes.update({ id: 1, name: "3D Printing", description: "Filaments, resin, and print-lab materials" });
    await caller.componentTypes.archive({ id: 1 });
    expect(db.insert).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it("prevents deleting a component type that is still assigned to inventory", async () => {
    const caller = organizationRouter.createCaller(adminContext());
    await expect(caller.componentTypes.remove({ id: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("deletes an unreferenced component type", async () => {
    const one = (rows: unknown[]) => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => rows) })) })) });
    db.select.mockReturnValueOnce(one([{ id: 1 }])).mockReturnValueOnce(one([]));
    const caller = organizationRouter.createCaller(adminContext());
    await expect(caller.componentTypes.remove({ id: 1 })).resolves.toEqual({ success: true });
    expect(db.delete).toHaveBeenCalled();
  });

  it("lets an Admin manage flexible inventory categories", async () => {
    const caller = organizationRouter.createCaller(adminContext());
    await caller.inventoryCategories.create({ name: "ميكانيكا", description: "مكونات ميكانيكية ومستلزمات الورشة", colorKey: "emerald" });
    await caller.inventoryCategories.update({ id: 1, name: "ميكانيكا وورشة", description: "تصنيف محدث", colorKey: "emerald" });
    await caller.inventoryCategories.archive({ id: 1 });
    expect(db.insert).toHaveBeenCalled();
    expect(db.transaction).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it("lets an Admin create, update, and archive a company record", async () => {
    const caller = organizationRouter.createCaller(adminContext());
    const company = { name: "شركة ميدتك", code: "MED-TECH", contactName: "Mariam", contactEmail: "mariam@example.com" };
    await caller.companies.create(company);
    await caller.companies.update({ id: 1, ...company, contactName: "Mariam Hassan" });
    await caller.companies.archive({ id: 1 });
    expect(db.insert).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });
});
