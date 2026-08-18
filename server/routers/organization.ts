import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { departments, employeeProfiles, employeeWarehouseRoleValues } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const departmentInput = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]+$/).min(2).max(32),
  description: z.string().trim().max(1000).optional(),
});

export const employeeInput = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  employeeCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]+$/).min(2).max(64),
  jobTitle: z.string().trim().min(2).max(160),
  departmentId: z.number().int().positive().nullable().optional(),
  warehouseRole: z.enum(employeeWarehouseRoleValues),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Organization data is temporarily unavailable." });
  return db;
}

function optionalText(value?: string) {
  return value?.trim() ? value.trim() : null;
}

export const organizationRouter = router({
  departments: router({
    list: adminProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(departments).orderBy(departments.isActive, departments.name);
    }),
    create: adminProcedure.input(departmentInput).mutation(async ({ input }) => {
      const db = await requireDb();
      try {
        await db.insert(departments).values({ ...input, description: optionalText(input.description) });
        const [created] = await db.select().from(departments).where(eq(departments.code, input.code)).limit(1);
        return created;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "A department with this name or code already exists." });
      }
    }),
    update: adminProcedure.input(departmentInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      const [existing] = await db.select({ id: departments.id }).from(departments).where(eq(departments.id, id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Department not found." });
      try {
        await db.update(departments).set({ ...values, description: optionalText(values.description) }).where(eq(departments.id, id));
        return { success: true } as const;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "A department with this name or code already exists." });
      }
    }),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(departments).set({ isActive: 0 }).where(eq(departments.id, input.id));
      return { success: true } as const;
    }),
  }),

  employees: router({
    list: adminProcedure.query(async () => {
      const db = await requireDb();
      return db
        .select({
          employee: employeeProfiles,
          department: { id: departments.id, name: departments.name, code: departments.code },
        })
        .from(employeeProfiles)
        .leftJoin(departments, eq(employeeProfiles.departmentId, departments.id))
        .orderBy(employeeProfiles.isActive, desc(employeeProfiles.createdAt));
    }),
    create: adminProcedure.input(employeeInput).mutation(async ({ input }) => {
      const db = await requireDb();
      try {
        await db.insert(employeeProfiles).values({ ...input, departmentId: input.departmentId ?? null });
        const [created] = await db.select().from(employeeProfiles).where(eq(employeeProfiles.employeeCode, input.employeeCode)).limit(1);
        return created;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "An employee with this email or employee code already exists." });
      }
    }),
    update: adminProcedure.input(employeeInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      const [existing] = await db.select({ id: employeeProfiles.id }).from(employeeProfiles).where(eq(employeeProfiles.id, id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
      try {
        await db.update(employeeProfiles).set({ ...values, departmentId: values.departmentId ?? null }).where(eq(employeeProfiles.id, id));
        return { success: true } as const;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "An employee with this email or employee code already exists." });
      }
    }),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(employeeProfiles).set({ isActive: 0 }).where(eq(employeeProfiles.id, input.id));
      return { success: true } as const;
    }),
  }),
});
