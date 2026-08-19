import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  requestedRole: mysqlEnum("requestedRole", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Company organizational units managed by the warehouse administrator. */
export const departments = mysqlTable(
  "departments",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull().unique(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    description: text("description"),
    isActive: int("isActive").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("departments_active_idx").on(table.isActive)],
);

export const employeeWarehouseRoleValues = ["admin", "engineer", "viewer"] as const;

/** Employee directory, which can be created before the employee activates a login account. */
export const employeeProfiles = mysqlTable(
  "employeeProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").unique().references(() => users.id, { onDelete: "set null" }),
    fullName: varchar("fullName", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    employeeCode: varchar("employeeCode", { length: 64 }).notNull().unique(),
    jobTitle: varchar("jobTitle", { length: 160 }).notNull(),
    departmentId: int("departmentId").references(() => departments.id, { onDelete: "set null" }),
    warehouseRole: mysqlEnum("warehouseRole", employeeWarehouseRoleValues).notNull().default("engineer"),
    isActive: int("isActive").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("employees_department_idx").on(table.departmentId),
    index("employees_active_idx").on(table.isActive),
  ],
);

/** Four warehouse classifications required by the engineering organization. */
export const partCategoryValues = ["Medical", "Embedded", "Electronics", "Boards"] as const;
export const warehouseSectionValues = ["components", "products"] as const;

/** General-purpose types for Components; they do not depend on a company department. */
export const componentTypes = mysqlTable(
  "componentTypes",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull().unique(),
    description: text("description"),
    isActive: int("isActive").notNull().default(1),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("component_types_active_idx").on(table.isActive)],
);

/** Current on-hand inventory for each tracked engineering part. */
export const parts = mysqlTable(
  "parts",
  {
    id: int("id").autoincrement().primaryKey(),
    partNumber: varchar("partNumber", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    category: mysqlEnum("category", partCategoryValues).notNull(),
    warehouseSection: mysqlEnum("warehouseSection", warehouseSectionValues).notNull().default("components"),
    componentTypeId: int("componentTypeId").references(() => componentTypes.id, { onDelete: "set null" }),
    quantity: int("quantity").notNull().default(0),
    reservedQuantity: int("reservedQuantity").notNull().default(0),
    minimumStock: int("minimumStock").notNull().default(0),
    location: varchar("location", { length: 160 }),
    storageShelf: varchar("storageShelf", { length: 80 }),
    storageDrawer: varchar("storageDrawer", { length: 80 }),
    storageBox: varchar("storageBox", { length: 80 }),
    imageUrl: varchar("imageUrl", { length: 500 }),
    specifications: text("specifications"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("parts_category_idx").on(table.category),
    index("parts_section_idx").on(table.warehouseSection),
    index("parts_component_type_idx").on(table.componentTypeId),
    index("parts_stock_idx").on(table.quantity, table.minimumStock),
  ],
);

export const dispensingStatusValues = ["pending", "approved", "rejected", "delivered"] as const;

/** An engineer's request for one stock part and a specific business purpose. */
export const dispensingRequests = mysqlTable(
  "dispensingRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    requestedById: int("requestedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    requestedQuantity: int("requestedQuantity").notNull(),
    purpose: text("purpose").notNull(),
    status: mysqlEnum("status", dispensingStatusValues).notNull().default("pending"),
    decisionNote: text("decisionNote"),
    reviewedById: int("reviewedById").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewedAt"),
    deliveredById: int("deliveredById").references(() => users.id, { onDelete: "set null" }),
    deliveredAt: timestamp("deliveredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("requests_status_idx").on(table.status),
    index("requests_requester_idx").on(table.requestedById),
    index("requests_part_idx").on(table.partId),
  ],
);

export const transactionTypeValues = [
  "part_created",
  "part_updated",
  "request_submitted",
  "request_approved",
  "request_rejected",
  "delivery_confirmed",
] as const;

/** Immutable audit records. A delivery creates the only negative quantity movement. */
export const inventoryTransactions = mysqlTable(
  "inventoryTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    requestId: int("requestId").references(() => dispensingRequests.id, { onDelete: "set null" }),
    type: mysqlEnum("type", transactionTypeValues).notNull(),
    quantityDelta: int("quantityDelta").notNull().default(0),
    quantityBefore: int("quantityBefore"),
    quantityAfter: int("quantityAfter"),
    actorId: int("actorId").references(() => users.id, { onDelete: "set null" }),
    engineerId: int("engineerId").references(() => users.id, { onDelete: "set null" }),
    partNumberSnapshot: varchar("partNumberSnapshot", { length: 100 }).notNull(),
    partNameSnapshot: varchar("partNameSnapshot", { length: 200 }).notNull(),
    warehouseSectionSnapshot: mysqlEnum("warehouseSectionSnapshot", warehouseSectionValues).notNull().default("components"),
    details: text("details"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("transactions_part_idx").on(table.partId),
    index("transactions_request_idx").on(table.requestId),
    index("transactions_date_idx").on(table.createdAt),
  ],
);

export const alertTypeValues = ["new_request", "low_stock", "request_approved", "request_rejected", "handover_completed"] as const;

/** Admin-facing in-app alerts, retained until marked as read. */
export const warehouseAlerts = mysqlTable(
  "warehouseAlerts",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", alertTypeValues).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    partId: int("partId").references(() => parts.id, { onDelete: "set null" }),
    requestId: int("requestId").references(() => dispensingRequests.id, { onDelete: "set null" }),
    recipientUserId: int("recipientUserId").references(() => users.id, { onDelete: "cascade" }),
    isRead: int("isRead").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("alerts_unread_idx").on(table.isRead, table.createdAt), index("alerts_recipient_idx").on(table.recipientUserId, table.isRead)],
);

/** Print-ready proof that an approved item was physically handed to the requesting user. */
export const handoverInvoices = mysqlTable(
  "handoverInvoices",
  {
    id: int("id").autoincrement().primaryKey(),
    invoiceNumber: varchar("invoiceNumber", { length: 48 }).notNull().unique(),
    requestId: int("requestId").notNull().unique().references(() => dispensingRequests.id, { onDelete: "restrict" }),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    issuedById: int("issuedById").references(() => users.id, { onDelete: "set null" }),
    receivedById: int("receivedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    partNumberSnapshot: varchar("partNumberSnapshot", { length: 100 }).notNull(),
    partNameSnapshot: varchar("partNameSnapshot", { length: 200 }).notNull(),
    warehouseSectionSnapshot: mysqlEnum("warehouseSectionSnapshot", warehouseSectionValues).notNull(),
    quantity: int("quantity").notNull(),
    purposeSnapshot: text("purposeSnapshot").notNull(),
    issuedAt: timestamp("issuedAt").notNull(),
    receiptConfirmedAt: timestamp("receiptConfirmedAt"),
    receiptConfirmationName: varchar("receiptConfirmationName", { length: 160 }),
    receiptNote: text("receiptNote"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("invoices_issued_at_idx").on(table.issuedAt)],
);

export const warehouseActivityTypeValues = ["inventory_created", "inventory_updated", "request_submitted", "request_approved", "request_rejected", "handover_completed", "handover_receipt_confirmed"] as const;

/** Recent warehouse events shown to the Admin on the control dashboard. */
export const warehouseActivities = mysqlTable(
  "warehouseActivities",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", warehouseActivityTypeValues).notNull(),
    actorId: int("actorId").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    detail: text("detail"),
    requestId: int("requestId").references(() => dispensingRequests.id, { onDelete: "set null" }),
    partId: int("partId").references(() => parts.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("warehouse_activity_date_idx").on(table.createdAt)],
);

export type Part = typeof parts.$inferSelect;
export type InsertPart = typeof parts.$inferInsert;
export type DispensingRequest = typeof dispensingRequests.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type EmployeeProfile = typeof employeeProfiles.$inferSelect;
export type ComponentType = typeof componentTypes.$inferSelect;
export type HandoverInvoice = typeof handoverInvoices.$inferSelect;
