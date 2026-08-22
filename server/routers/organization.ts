import { TRPCError } from "@trpc/server";
import { desc, eq, or } from "drizzle-orm";
import { componentTypes, departments, dispensingRequests, employeeProfiles, employeeWarehouseRoleValues, handoverInvoices, inventoryCategories, inventoryTransactions, parts, users, warehouseActivities, warehouseAlerts } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const departmentInput = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().toUpperCase().regex(/^[- A-Z0-9\u0621-\u064A\u0660-\u0669\u0670-\u06FF]+$/, "رمز القسم يقبل الحروف والأرقام والمسافات والشرطة فقط.").min(2).max(32),
  description: z.string().trim().max(1000).optional(),
});

export const employeeInput = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  employeeCode: z.string().trim().toUpperCase().regex(/^[- A-Z0-9\u0621-\u064A\u0660-\u0669\u0670-\u06FF]+$/, "كود الموظف يقبل الحروف والأرقام والمسافات والشرطة فقط.").min(2).max(64),
  jobTitle: z.string().trim().min(2).max(160),
  departmentId: z.number().int().positive().nullable().optional(),
  warehouseRole: z.enum(employeeWarehouseRoleValues),
});

export const componentTypeInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
});

export const inventoryCategoryInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  colorKey: z.enum(["blue", "sky", "violet", "amber", "emerald", "rose", "slate"]).default("blue"),
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
  inventoryCategories: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(inventoryCategories).orderBy(inventoryCategories.isActive, inventoryCategories.name);
    }),
    create: adminProcedure.input(inventoryCategoryInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        await db.insert(inventoryCategories).values({ name: input.name, description: optionalText(input.description), colorKey: input.colorKey, createdById: ctx.user.id });
        const [created] = await db.select().from(inventoryCategories).where(eq(inventoryCategories.name, input.name)).limit(1);
        return created;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "يوجد بالفعل تصنيف مخزون بهذا الاسم." });
      }
    }),
    update: adminProcedure.input(inventoryCategoryInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb(); const { id, ...values } = input;
      const [existing] = await db.select().from(inventoryCategories).where(eq(inventoryCategories.id, id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "تصنيف المخزون غير موجود." });
      try {
        await db.transaction(async tx => {
          await tx.update(inventoryCategories).set({ name: values.name, description: optionalText(values.description), colorKey: values.colorKey }).where(eq(inventoryCategories.id, id));
          if (existing.name !== values.name) await tx.update(parts).set({ category: values.name }).where(eq(parts.categoryId, id));
        });
        return { success: true } as const;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "يوجد بالفعل تصنيف مخزون بهذا الاسم." });
      }
    }),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(inventoryCategories).set({ isActive: 0 }).where(eq(inventoryCategories.id, input.id));
      return { success: true } as const;
    }),
  }),

  componentTypes: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(componentTypes).orderBy(componentTypes.isActive, componentTypes.name);
    }),
    create: adminProcedure.input(componentTypeInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        await db.insert(componentTypes).values({ name: input.name, description: optionalText(input.description), createdById: ctx.user.id });
        const [created] = await db.select().from(componentTypes).where(eq(componentTypes.name, input.name)).limit(1);
        return created;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "A component type with this name already exists." });
      }
    }),
    update: adminProcedure.input(componentTypeInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      const [existing] = await db.select({ id: componentTypes.id }).from(componentTypes).where(eq(componentTypes.id, id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Component type not found." });
      try {
        await db.update(componentTypes).set({ name: values.name, description: optionalText(values.description) }).where(eq(componentTypes.id, id));
        return { success: true } as const;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "A component type with this name already exists." });
      }
    }),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(componentTypes).set({ isActive: 0 }).where(eq(componentTypes.id, input.id));
      return { success: true } as const;
    }),
  }),

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

  users: router({
    list: adminProcedure.query(async () => {
      const db = await requireDb();
      const [accounts, requests, invoices, transactions, alerts, activities] = await Promise.all([
        db.select({ account: users, employee: employeeProfiles, department: { id: departments.id, name: departments.name, code: departments.code } })
          .from(users)
          .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
          .leftJoin(departments, eq(employeeProfiles.departmentId, departments.id))
          .orderBy(desc(users.lastSignedIn)),
        db.select({ requestedById: dispensingRequests.requestedById, status: dispensingRequests.status }).from(dispensingRequests).limit(500),
        db.select({ receivedById: handoverInvoices.receivedById, issuedById: handoverInvoices.issuedById }).from(handoverInvoices).limit(500),
        db.select({ actorId: inventoryTransactions.actorId, engineerId: inventoryTransactions.engineerId }).from(inventoryTransactions).limit(1000),
        db.select({ recipientUserId: warehouseAlerts.recipientUserId, isRead: warehouseAlerts.isRead }).from(warehouseAlerts).limit(500),
        db.select({ actorId: warehouseActivities.actorId, createdAt: warehouseActivities.createdAt }).from(warehouseActivities).orderBy(desc(warehouseActivities.createdAt)).limit(1000),
      ]);

      return accounts.map(({ account, employee, department }) => {
        const userRequests = requests.filter(request => request.requestedById === account.id);
        const userAlerts = alerts.filter(alert => alert.recipientUserId === account.id);
        const userActivities = activities.filter(activity => activity.actorId === account.id);
        return {
          account,
          employee,
          department,
          summary: {
            requestCount: userRequests.length,
            pendingRequestCount: userRequests.filter(request => request.status === "pending").length,
            approvedRequestCount: userRequests.filter(request => request.status === "approved").length,
            deliveredRequestCount: userRequests.filter(request => request.status === "delivered").length,
            rejectedRequestCount: userRequests.filter(request => request.status === "rejected").length,
            receivedInvoiceCount: invoices.filter(invoice => invoice.receivedById === account.id).length,
            issuedInvoiceCount: invoices.filter(invoice => invoice.issuedById === account.id).length,
            transactionCount: transactions.filter(transaction => transaction.actorId === account.id || transaction.engineerId === account.id).length,
            activityCount: userActivities.length,
            unreadAlertCount: userAlerts.filter(alert => !alert.isRead).length,
            lastActivityAt: userActivities[0]?.createdAt ?? null,
          },
        };
      });
    }),

    activity: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb();
      const [accountResult, requests, invoices, transactions, alerts, activities] = await Promise.all([
        db.select({ account: users, employee: employeeProfiles, department: { id: departments.id, name: departments.name, code: departments.code } })
          .from(users)
          .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
          .leftJoin(departments, eq(employeeProfiles.departmentId, departments.id))
          .where(eq(users.id, input.userId))
          .limit(1),
        db.select({ request: dispensingRequests, part: { id: parts.id, name: parts.name, partNumber: parts.partNumber, warehouseSection: parts.warehouseSection } })
          .from(dispensingRequests)
          .innerJoin(parts, eq(dispensingRequests.partId, parts.id))
          .where(eq(dispensingRequests.requestedById, input.userId))
          .orderBy(desc(dispensingRequests.createdAt))
          .limit(100),
        db.select().from(handoverInvoices).where(or(eq(handoverInvoices.receivedById, input.userId), eq(handoverInvoices.issuedById, input.userId))).orderBy(desc(handoverInvoices.issuedAt)).limit(100),
        db.select().from(inventoryTransactions).where(or(eq(inventoryTransactions.actorId, input.userId), eq(inventoryTransactions.engineerId, input.userId))).orderBy(desc(inventoryTransactions.createdAt)).limit(150),
        db.select().from(warehouseAlerts).where(eq(warehouseAlerts.recipientUserId, input.userId)).orderBy(desc(warehouseAlerts.createdAt)).limit(100),
        db.select().from(warehouseActivities).where(eq(warehouseActivities.actorId, input.userId)).orderBy(desc(warehouseActivities.createdAt)).limit(150),
      ]);
      const account = accountResult[0];
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "حساب المستخدم غير موجود." });
      return { ...account, requests, invoices, transactions, alerts, activities };
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
