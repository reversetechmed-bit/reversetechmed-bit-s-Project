import { TRPCError } from "@trpc/server";
import { desc, eq, or } from "drizzle-orm";
import { companies, componentTypes, departments, dispensingRequests, employeeProfiles, employeeWarehouseRoleValues, handoverInvoices, inventoryCategories, inventoryTransactions, parts, productComponents, users, warehouseActivities, warehouseAlerts } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const departmentInput = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().toUpperCase().regex(/^[- A-Z0-9\u0621-\u064A\u0660-\u0669\u0670-\u06FF]+$/, "رمز القسم يقبل الحروف والأرقام والمسافات والشرطة فقط.").min(2).max(32),
  description: z.string().trim().max(1000).optional(),
});

export const employeeInput = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
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

export const companyInput = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().toUpperCase().regex(/^[- A-Z0-9\u0621-\u064A\u0660-\u0669\u0670-\u06FF]+$/, "رمز الشركة يقبل الحروف والأرقام والمسافات والشرطة فقط.").min(2).max(48),
  contactName: z.string().trim().max(160).optional(),
  contactPhone: z.string().trim().max(48).optional(),
  contactEmail: z.string().trim().email().max(320).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const productBomInput = z.object({
  productId: z.number().int().positive(),
  components: z.array(z.object({ componentId: z.number().int().positive(), quantityRequired: z.number().int().positive(), notes: z.string().trim().max(1000).optional() })).max(100),
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
  enrollment: router({
    eligibility: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).mutation(async ({ input }) => {
      const db = await requireDb();
      const [employee] = await db.select({ id: employeeProfiles.id, isActive: employeeProfiles.isActive, userId: employeeProfiles.userId }).from(employeeProfiles).where(eq(employeeProfiles.email, input.email)).limit(1);
      return { eligible: Boolean(employee?.isActive && !employee.userId) };
    }),
  }),

  companies: router({
    list: adminProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(companies).orderBy(companies.isActive, companies.name);
    }),
    create: adminProcedure.input(companyInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        await db.insert(companies).values({ ...input, contactName: optionalText(input.contactName), contactPhone: optionalText(input.contactPhone), contactEmail: optionalText(input.contactEmail), notes: optionalText(input.notes), createdById: ctx.user.id });
        const [created] = await db.select().from(companies).where(eq(companies.code, input.code)).limit(1);
        return created;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "يوجد بالفعل سجل شركة بالاسم أو الرمز نفسه." });
      }
    }),
    update: adminProcedure.input(companyInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb(); const { id, ...values } = input;
      const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "الشركة غير موجودة." });
      try {
        await db.update(companies).set({ ...values, contactName: optionalText(values.contactName), contactPhone: optionalText(values.contactPhone), contactEmail: optionalText(values.contactEmail), notes: optionalText(values.notes) }).where(eq(companies.id, id));
        return { success: true } as const;
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "يوجد بالفعل سجل شركة بالاسم أو الرمز نفسه." });
      }
    }),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(companies).set({ isActive: 0 }).where(eq(companies.id, input.id));
      return { success: true } as const;
    }),
  }),

  productComponents: router({
    list: adminProcedure.input(z.object({ productId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb();
      return db.select({ bom: productComponents, component: parts }).from(productComponents).innerJoin(parts, eq(productComponents.componentId, parts.id)).where(eq(productComponents.productId, input.productId)).orderBy(parts.name);
    }),
    replace: adminProcedure.input(productBomInput).mutation(async ({ input }) => {
      const db = await requireDb();
      const uniqueComponentIds = new Set(input.components.map(component => component.componentId));
      if (uniqueComponentIds.size !== input.components.length) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تكرار المكون نفسه داخل قائمة مكونات المنتج." });
      if (uniqueComponentIds.has(input.productId)) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن أن يكون المنتج مكونًا لنفسه." });
      return db.transaction(async tx => {
        const [product] = await tx.select().from(parts).where(eq(parts.id, input.productId)).limit(1);
        if (!product || product.warehouseSection !== "products") throw new TRPCError({ code: "BAD_REQUEST", message: "اختر منتجًا من قسم المنتجات لضبط قائمة مكوناته." });
        const validComponents = await tx.select({ id: parts.id, warehouseSection: parts.warehouseSection, productStage: parts.productStage }).from(parts);
        const validIds = new Set(validComponents.filter(component => component.warehouseSection === "components" || (component.warehouseSection === "products" && component.productStage === "work_in_progress")).map(component => component.id));
        if (input.components.some(component => !validIds.has(component.componentId))) throw new TRPCError({ code: "BAD_REQUEST", message: "يمكن ربط المنتج بمكونات المخزون أو المنتجات تحت التشغيل فقط." });
        await tx.delete(productComponents).where(eq(productComponents.productId, product.id));
        if (input.components.length) await tx.insert(productComponents).values(input.components.map(component => ({ productId: product.id, componentId: component.componentId, quantityRequired: component.quantityRequired, notes: optionalText(component.notes) })));
        return { success: true } as const;
      });
    }),
  }),

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
        await db.insert(employeeProfiles).values({ ...input, email: optionalText(input.email), departmentId: input.departmentId ?? null });
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
        await db.update(employeeProfiles).set({ ...values, email: optionalText(values.email), departmentId: values.departmentId ?? null }).where(eq(employeeProfiles.id, id));
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
    linkAccount: adminProcedure.input(z.object({ employeeId: z.number().int().positive(), userId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await requireDb();
      return db.transaction(async tx => {
        const [employee] = await tx.select().from(employeeProfiles).where(eq(employeeProfiles.id, input.employeeId)).limit(1);
        const [account] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (!employee || !employee.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ملف الموظف النشط غير موجود." });
        if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "حساب المستخدم غير موجود." });
        if (employee.userId && employee.userId !== account.id) throw new TRPCError({ code: "CONFLICT", message: "هذا الموظف مرتبط بحساب آخر بالفعل." });
        const [otherEmployee] = await tx.select({ id: employeeProfiles.id }).from(employeeProfiles).where(eq(employeeProfiles.userId, account.id)).limit(1);
        if (otherEmployee && otherEmployee.id !== employee.id) throw new TRPCError({ code: "CONFLICT", message: "هذا الحساب مرتبط بموظف آخر بالفعل." });
        await tx.update(employeeProfiles).set({ userId: account.id }).where(eq(employeeProfiles.id, employee.id));
        await tx.update(users).set({ name: employee.fullName, role: employee.warehouseRole === "admin" ? "admin" : "user", requestedRole: employee.warehouseRole === "admin" ? "admin" : "user" }).where(eq(users.id, account.id));
        return { success: true } as const;
      });
    }),
  }),
});
