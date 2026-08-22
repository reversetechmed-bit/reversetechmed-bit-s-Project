import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  deletedAt: timestamp("deletedAt"),
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
    email: varchar("email", { length: 320 }).unique(),
    employeeCode: varchar("employeeCode", { length: 64 }).notNull().unique(),
    jobTitle: varchar("jobTitle", { length: 160 }).notNull(),
    departmentId: int("departmentId").references(() => departments.id, { onDelete: "set null" }),
    warehouseRole: mysqlEnum("warehouseRole", employeeWarehouseRoleValues).notNull().default("engineer"),
    isActive: int("isActive").notNull().default(1),
    initialPasswordHash: varchar("initialPasswordHash", { length: 128 }),
    initialPasswordIssuedAt: timestamp("initialPasswordIssuedAt"),
    suspendedUntil: timestamp("suspendedUntil"),
    accessRevokedAt: timestamp("accessRevokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("employees_department_idx").on(table.departmentId),
    index("employees_active_idx").on(table.isActive),
    index("employees_suspension_idx").on(table.suspendedUntil),
  ],
);

/** Single-use passcode issued by an Admin to let a pre-registered employee claim an approved account identity. */
export const employeeEnrollmentPasscodes = mysqlTable(
  "employeeEnrollmentPasscodes",
  {
    id: int("id").autoincrement().primaryKey(),
    employeeId: int("employeeId").notNull().unique().references(() => employeeProfiles.id, { onDelete: "cascade" }),
    codeHash: varchar("codeHash", { length: 128 }).notNull(),
    issuedById: int("issuedById").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("employee_passcodes_expiry_idx").on(table.expiresAt)],
);

/** Four warehouse classifications required by the engineering organization. */
export const partCategoryValues = ["Medical", "Embedded", "Electronics", "Boards"] as const;
export const warehouseSectionValues = ["components", "products"] as const;

export const inventoryCategories = mysqlTable(
  "inventoryCategories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull().unique(),
    description: text("description"),
    colorKey: varchar("colorKey", { length: 24 }).notNull().default("blue"),
    isActive: int("isActive").notNull().default(1),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("inventoryCategories_active_name_idx").on(table.isActive, table.name)],
);

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

/** External companies whose devices, boards, and engineering products are tracked by the warehouse. */
export const companies = mysqlTable(
  "companies",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 200 }).notNull().unique(),
    code: varchar("code", { length: 48 }).notNull().unique(),
    contactName: varchar("contactName", { length: 160 }),
    contactPhone: varchar("contactPhone", { length: 48 }),
    contactEmail: varchar("contactEmail", { length: 320 }),
    notes: text("notes"),
    isActive: int("isActive").notNull().default(1),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("companies_active_name_idx").on(table.isActive, table.name)],
);

export const productStageValues = ["work_in_progress", "under_review", "under_maintenance", "finished", "final_operational"] as const;

/** Current on-hand inventory for each tracked engineering part. */
export const parts = mysqlTable(
  "parts",
  {
    id: int("id").autoincrement().primaryKey(),
    partNumber: varchar("partNumber", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 120 }).notNull(),
    categoryId: int("categoryId").references(() => inventoryCategories.id, { onDelete: "set null" }),
    warehouseSection: mysqlEnum("warehouseSection", warehouseSectionValues).notNull().default("components"),
    componentTypeId: int("componentTypeId").references(() => componentTypes.id, { onDelete: "set null" }),
    companyId: int("companyId").references(() => companies.id, { onDelete: "set null" }),
    productStage: mysqlEnum("productStage", productStageValues),
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
    index("parts_company_idx").on(table.companyId),
    index("parts_stock_idx").on(table.quantity, table.minimumStock),
  ],
);

/** Bill of materials for a warehouse product. Component rows remain the single source of truth for stock. */
export const productComponents = mysqlTable(
  "productComponents",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull().references(() => parts.id, { onDelete: "cascade" }),
    componentId: int("componentId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    quantityRequired: int("quantityRequired").notNull().default(1),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("product_components_unique_idx").on(table.productId, table.componentId),
    index("product_components_component_idx").on(table.componentId),
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
    recipientName: varchar("recipientName", { length: 160 }),
    recipientDepartment: varchar("recipientDepartment", { length: 160 }),
    projectReference: varchar("projectReference", { length: 160 }),
    requestNote: text("requestNote"),
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

export const maintenanceCaseTypeValues = ["maintenance_outbound", "customer_return"] as const;
export const maintenanceCaseStatusValues = ["open", "sent_for_maintenance", "awaiting_inspection", "returned_to_stock", "closed", "cancelled"] as const;

/** Controlled custody record for parts sent to maintenance or returned from a customer. */
export const maintenanceCases = mysqlTable(
  "maintenanceCases",
  {
    id: int("id").autoincrement().primaryKey(),
    caseNumber: varchar("caseNumber", { length: 48 }).notNull().unique(),
    type: mysqlEnum("type", maintenanceCaseTypeValues).notNull(),
    status: mysqlEnum("status", maintenanceCaseStatusValues).notNull().default("open"),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    quantity: int("quantity").notNull(),
    customerName: varchar("customerName", { length: 200 }),
    customerReference: varchar("customerReference", { length: 160 }),
    outboundCondition: text("outboundCondition"),
    inboundCondition: text("inboundCondition"),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    dispatchedById: int("dispatchedById").references(() => users.id, { onDelete: "set null" }),
    receivedById: int("receivedById").references(() => users.id, { onDelete: "set null" }),
    sentAt: timestamp("sentAt"),
    returnedAt: timestamp("returnedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("maintenance_cases_status_idx").on(table.status, table.createdAt),
    index("maintenance_cases_part_idx").on(table.partId),
  ],
);

export const purchaseOrderStatusValues = ["draft", "ordered", "partially_received", "received", "cancelled"] as const;

/** Purchase order header, using the existing company directory as the supplier directory. */
export const purchaseOrders = mysqlTable(
  "purchaseOrders",
  {
    id: int("id").autoincrement().primaryKey(),
    orderNumber: varchar("orderNumber", { length: 48 }).notNull().unique(),
    supplierCompanyId: int("supplierCompanyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", purchaseOrderStatusValues).notNull().default("draft"),
    expectedAt: timestamp("expectedAt"),
    orderedAt: timestamp("orderedAt"),
    receivedAt: timestamp("receivedAt"),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("purchase_orders_status_idx").on(table.status, table.createdAt),
    index("purchase_orders_supplier_idx").on(table.supplierCompanyId),
  ],
);

/** Individual item lines of a purchase order, including the shortage snapshot that prompted procurement. */
export const purchaseOrderLines = mysqlTable(
  "purchaseOrderLines",
  {
    id: int("id").autoincrement().primaryKey(),
    purchaseOrderId: int("purchaseOrderId").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    quantityOrdered: int("quantityOrdered").notNull(),
    quantityReceived: int("quantityReceived").notNull().default(0),
    shortageQuantitySnapshot: int("shortageQuantitySnapshot"),
    shortageReason: varchar("shortageReason", { length: 240 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("purchase_order_lines_unique_idx").on(table.purchaseOrderId, table.partId),
    index("purchase_order_lines_part_idx").on(table.partId),
  ],
);

export const assemblyOrderStatusValues = ["draft", "completed", "cancelled"] as const;

/** An auditable build record that consumes BOM sources and produces a finished product. */
export const assemblyOrders = mysqlTable(
  "assemblyOrders",
  {
    id: int("id").autoincrement().primaryKey(),
    assemblyNumber: varchar("assemblyNumber", { length: 48 }).notNull().unique(),
    targetProductId: int("targetProductId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    quantityToProduce: int("quantityToProduce").notNull(),
    status: mysqlEnum("status", assemblyOrderStatusValues).notNull().default("draft"),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    completedById: int("completedById").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("assembly_orders_status_idx").on(table.status, table.createdAt), index("assembly_orders_target_idx").on(table.targetProductId)],
);

/** Frozen component list captured for each assembly order. */
export const assemblyOrderLines = mysqlTable(
  "assemblyOrderLines",
  {
    id: int("id").autoincrement().primaryKey(),
    assemblyOrderId: int("assemblyOrderId").notNull().references(() => assemblyOrders.id, { onDelete: "cascade" }),
    sourcePartId: int("sourcePartId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    quantityPerUnit: int("quantityPerUnit").notNull(),
    quantityConsumed: int("quantityConsumed").notNull(),
    partNumberSnapshot: varchar("partNumberSnapshot", { length: 100 }).notNull(),
    partNameSnapshot: varchar("partNameSnapshot", { length: 200 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("assembly_order_lines_unique_idx").on(table.assemblyOrderId, table.sourcePartId)],
);

export const transactionTypeValues = [
  "part_created",
  "part_updated",
  "request_submitted",
  "request_approved",
  "request_rejected",
  "delivery_confirmed",
  "maintenance_dispatched",
  "maintenance_returned",
  "purchase_received",
  "assembly_consumed",
  "assembly_produced",
] as const;

/** Immutable audit records. A delivery creates the only negative quantity movement. */
export const inventoryTransactions = mysqlTable(
  "inventoryTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    requestId: int("requestId").references(() => dispensingRequests.id, { onDelete: "set null" }),
    maintenanceCaseId: int("maintenanceCaseId").references(() => maintenanceCases.id, { onDelete: "set null" }),
    purchaseOrderId: int("purchaseOrderId").references(() => purchaseOrders.id, { onDelete: "set null" }),
    assemblyOrderId: int("assemblyOrderId").references(() => assemblyOrders.id, { onDelete: "set null" }),
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
    index("transactions_maintenance_idx").on(table.maintenanceCaseId),
    index("transactions_purchase_order_idx").on(table.purchaseOrderId),
    index("transactions_assembly_order_idx").on(table.assemblyOrderId),
    index("transactions_date_idx").on(table.createdAt),
  ],
);

export const alertTypeValues = ["new_request", "low_stock", "request_approved", "request_rejected", "handover_completed", "overdue_request", "receipt_confirmation_pending", "maintenance_returned", "purchase_received", "assembly_completed"] as const;

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
    maintenanceCaseId: int("maintenanceCaseId").references(() => maintenanceCases.id, { onDelete: "set null" }),
    purchaseOrderId: int("purchaseOrderId").references(() => purchaseOrders.id, { onDelete: "set null" }),
    assemblyOrderId: int("assemblyOrderId").references(() => assemblyOrders.id, { onDelete: "set null" }),
    recipientUserId: int("recipientUserId").references(() => users.id, { onDelete: "cascade" }),
    dedupeKey: varchar("dedupeKey", { length: 160 }).unique(),
    isRead: int("isRead").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("alerts_unread_idx").on(table.isRead, table.createdAt), index("alerts_recipient_idx").on(table.recipientUserId, table.isRead), index("alerts_type_part_idx").on(table.type, table.partId)],
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
    requesterNameSnapshot: varchar("requesterNameSnapshot", { length: 160 }),
    recipientNameSnapshot: varchar("recipientNameSnapshot", { length: 160 }),
    recipientDepartmentSnapshot: varchar("recipientDepartmentSnapshot", { length: 160 }),
    projectReferenceSnapshot: varchar("projectReferenceSnapshot", { length: 160 }),
    requestNoteSnapshot: text("requestNoteSnapshot"),
    deliveryNote: text("deliveryNote"),
    issuedAt: timestamp("issuedAt").notNull(),
    receiptConfirmedAt: timestamp("receiptConfirmedAt"),
    receiptConfirmationName: varchar("receiptConfirmationName", { length: 160 }),
    receiptNote: text("receiptNote"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("invoices_issued_at_idx").on(table.issuedAt)],
);

export const warehouseActivityTypeValues = ["inventory_created", "inventory_updated", "request_submitted", "request_approved", "request_rejected", "handover_completed", "handover_receipt_confirmed", "maintenance_dispatched", "maintenance_returned", "purchase_order_created", "purchase_received", "assembly_completed"] as const;

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
    maintenanceCaseId: int("maintenanceCaseId").references(() => maintenanceCases.id, { onDelete: "set null" }),
    purchaseOrderId: int("purchaseOrderId").references(() => purchaseOrders.id, { onDelete: "set null" }),
    assemblyOrderId: int("assemblyOrderId").references(() => assemblyOrders.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("warehouse_activity_date_idx").on(table.createdAt)],
);

/** Durable project-level record for the managed warehouse escalation Heartbeat job. */
export const warehouseAutomationSettings = mysqlTable(
  "warehouseAutomationSettings",
  {
    id: int("id").autoincrement().primaryKey(),
    settingKey: varchar("settingKey", { length: 64 }).notNull().unique(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
    cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
    isEnabled: int("isEnabled").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("warehouse_automation_enabled_idx").on(table.isEnabled)],
);

export type Part = typeof parts.$inferSelect;
export type InsertPart = typeof parts.$inferInsert;
export type DispensingRequest = typeof dispensingRequests.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type EmployeeProfile = typeof employeeProfiles.$inferSelect;
export type EmployeeEnrollmentPasscode = typeof employeeEnrollmentPasscodes.$inferSelect;
export type ComponentType = typeof componentTypes.$inferSelect;
export type HandoverInvoice = typeof handoverInvoices.$inferSelect;
export type MaintenanceCase = typeof maintenanceCases.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type AssemblyOrder = typeof assemblyOrders.$inferSelect;
export type WarehouseAutomationSetting = typeof warehouseAutomationSettings.$inferSelect;
