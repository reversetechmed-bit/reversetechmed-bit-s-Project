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

export const employeeWarehouseRoleValues = ["admin", "engineer", "viewer", "storekeeper", "maintenance_technician", "purchasing_officer"] as const;

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
export const serialTrackingModeValues = ["none", "serial"] as const;

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
    custodyQuantity: int("custodyQuantity").notNull().default(0),
    minimumStock: int("minimumStock").notNull().default(0),
    location: varchar("location", { length: 160 }),
    storageShelf: varchar("storageShelf", { length: 80 }),
    storageDrawer: varchar("storageDrawer", { length: 80 }),
    storageBox: varchar("storageBox", { length: 80 }),
    imageUrl: varchar("imageUrl", { length: 500 }),
    specifications: text("specifications"),
    barcode: varchar("barcode", { length: 100 }).unique(),
    serialTrackingMode: mysqlEnum("serialTrackingMode", serialTrackingModeValues).notNull().default("none"),
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
    index("parts_barcode_idx").on(table.barcode),
  ],
);

/** Physical locations may be labelled and scanned independently of item barcodes. */
export const storageLocations = mysqlTable(
  "storageLocations",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    barcode: varchar("barcode", { length: 100 }).notNull().unique(),
    shelf: varchar("shelf", { length: 80 }),
    drawer: varchar("drawer", { length: 80 }),
    box: varchar("box", { length: 80 }),
    notes: text("notes"),
    isActive: int("isActive").notNull().default(1),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("storage_locations_active_idx").on(table.isActive), index("storage_locations_barcode_idx").on(table.barcode)],
);

export const serialAssetStatusValues = ["in_stock", "in_custody", "in_maintenance", "in_production", "installed", "retired", "cannibalized", "scrapped"] as const;

/** Individually tracked boards and devices. Creating the record alone never changes item quantity. */
export const serialAssets = mysqlTable(
  "serialAssets",
  {
    id: int("id").autoincrement().primaryKey(),
    serialNumber: varchar("serialNumber", { length: 160 }).notNull().unique(),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", serialAssetStatusValues).notNull().default("in_stock"),
    locationId: int("locationId").references(() => storageLocations.id, { onDelete: "set null" }),
    currentHolderId: int("currentHolderId").references(() => users.id, { onDelete: "set null" }),
    assetCondition: varchar("assetCondition", { length: 160 }),
    manufacturerSerial: varchar("manufacturerSerial", { length: 160 }),
    acquiredAt: timestamp("acquiredAt"),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("serial_assets_part_status_idx").on(table.partId, table.status), index("serial_assets_holder_idx").on(table.currentHolderId), index("serial_assets_location_idx").on(table.locationId)],
);

export const serialAssetEventTypeValues = ["registered", "moved", "custody_issued", "custody_returned", "maintenance_opened", "work_started", "work_completed", "installed", "disassembled", "retired"] as const;

/** Append-only lifecycle history for a serial asset. */
export const serialAssetEvents = mysqlTable(
  "serialAssetEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    serialAssetId: int("serialAssetId").notNull().references(() => serialAssets.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", serialAssetEventTypeValues).notNull(),
    fromStatus: mysqlEnum("fromStatus", serialAssetStatusValues),
    toStatus: mysqlEnum("toStatus", serialAssetStatusValues),
    locationId: int("locationId").references(() => storageLocations.id, { onDelete: "set null" }),
    holderId: int("holderId").references(() => users.id, { onDelete: "set null" }),
    actorId: int("actorId").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("serial_asset_events_asset_idx").on(table.serialAssetId, table.createdAt)],
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

export const inventoryCountSessionStatusValues = ["draft", "open", "submitted", "approved", "cancelled"] as const;

/** A frozen stock expectation used to reconcile physical counts without changing stock during counting. */
export const inventoryCountSessions = mysqlTable(
  "inventoryCountSessions",
  {
    id: int("id").autoincrement().primaryKey(),
    countNumber: varchar("countNumber", { length: 48 }).notNull().unique(),
    status: mysqlEnum("status", inventoryCountSessionStatusValues).notNull().default("draft"),
    warehouseSection: mysqlEnum("warehouseSection", warehouseSectionValues),
    openedById: int("openedById").references(() => users.id, { onDelete: "set null" }),
    submittedById: int("submittedById").references(() => users.id, { onDelete: "set null" }),
    approvedById: int("approvedById").references(() => users.id, { onDelete: "set null" }),
    openedAt: timestamp("openedAt"),
    submittedAt: timestamp("submittedAt"),
    approvedAt: timestamp("approvedAt"),
    notes: text("notes"),
    approvalNote: text("approvalNote"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("count_sessions_status_idx").on(table.status, table.createdAt), index("count_sessions_section_idx").on(table.warehouseSection)],
);

/** One frozen expected quantity and one physical count per part within an inventory count session. */
export const inventoryCountLines = mysqlTable(
  "inventoryCountLines",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull().references(() => inventoryCountSessions.id, { onDelete: "cascade" }),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    expectedQuantity: int("expectedQuantity").notNull(),
    expectedReservedQuantity: int("expectedReservedQuantity").notNull().default(0),
    expectedCustodyQuantity: int("expectedCustodyQuantity").notNull().default(0),
    countedQuantity: int("countedQuantity"),
    varianceQuantity: int("varianceQuantity"),
    discrepancyReason: text("discrepancyReason"),
    countedById: int("countedById").references(() => users.id, { onDelete: "set null" }),
    countedAt: timestamp("countedAt"),
    partNumberSnapshot: varchar("partNumberSnapshot", { length: 100 }).notNull(),
    partNameSnapshot: varchar("partNameSnapshot", { length: 200 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("count_lines_session_part_uq").on(table.sessionId, table.partId), index("count_lines_part_idx").on(table.partId)],
);

export const workOrderTypeValues = ["production", "repair"] as const;
export const workOrderStatusValues = ["draft", "released", "in_progress", "quality_check", "completed", "cancelled"] as const;
export const workOrderPriorityValues = ["low", "normal", "high", "urgent"] as const;

/** Production and repair execution card. Stock changes remain guarded by the completion operation. */
export const workOrders = mysqlTable(
  "workOrders",
  {
    id: int("id").autoincrement().primaryKey(),
    workOrderNumber: varchar("workOrderNumber", { length: 48 }).notNull().unique(),
    type: mysqlEnum("type", workOrderTypeValues).notNull(),
    status: mysqlEnum("status", workOrderStatusValues).notNull().default("draft"),
    targetPartId: int("targetPartId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    serialAssetId: int("serialAssetId").references(() => serialAssets.id, { onDelete: "set null" }),
    departmentId: int("departmentId").references(() => departments.id, { onDelete: "set null" }),
    quantityPlanned: int("quantityPlanned").notNull().default(1),
    assigneeId: int("assigneeId").references(() => users.id, { onDelete: "set null" }),
    priority: mysqlEnum("priority", workOrderPriorityValues).notNull().default("normal"),
    dueAt: timestamp("dueAt"),
    releasedAt: timestamp("releasedAt"),
    startedAt: timestamp("startedAt"),
    qualityCheckedById: int("qualityCheckedById").references(() => users.id, { onDelete: "set null" }),
    qualityCheckedAt: timestamp("qualityCheckedAt"),
    qualityOutcome: varchar("qualityOutcome", { length: 64 }),
    completedById: int("completedById").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completedAt"),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("work_orders_status_idx").on(table.status, table.createdAt), index("work_orders_assignee_idx").on(table.assigneeId, table.status), index("work_orders_department_idx").on(table.departmentId, table.status), index("work_orders_target_idx").on(table.targetPartId)],
);

/** Immutable BOM snapshot recorded when a production work order is released. */
export const workOrderLines = mysqlTable(
  "workOrderLines",
  {
    id: int("id").autoincrement().primaryKey(),
    workOrderId: int("workOrderId").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
    sourcePartId: int("sourcePartId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    quantityPerUnit: int("quantityPerUnit").notNull(),
    quantityRequired: int("quantityRequired").notNull(),
    quantityConsumed: int("quantityConsumed").notNull().default(0),
    partNumberSnapshot: varchar("partNumberSnapshot", { length: 100 }).notNull(),
    partNameSnapshot: varchar("partNameSnapshot", { length: 200 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("work_order_lines_uq").on(table.workOrderId, table.sourcePartId)],
);

export const disassemblyStatusValues = ["draft", "submitted", "approved", "completed", "cancelled"] as const;
export const recoveredConditionValues = ["serviceable", "quarantine", "scrap"] as const;

/** Controlled one-time disassembly of a returned, retired, or otherwise eligible source. */
export const disassemblyOrders = mysqlTable(
  "disassemblyOrders",
  {
    id: int("id").autoincrement().primaryKey(),
    disassemblyNumber: varchar("disassemblyNumber", { length: 48 }).notNull().unique(),
    status: mysqlEnum("status", disassemblyStatusValues).notNull().default("draft"),
    sourcePartId: int("sourcePartId").references(() => parts.id, { onDelete: "restrict" }),
    sourceSerialAssetId: int("sourceSerialAssetId").unique().references(() => serialAssets.id, { onDelete: "restrict" }),
    sourceMaintenanceCaseId: int("sourceMaintenanceCaseId").references(() => maintenanceCases.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    approvedById: int("approvedById").references(() => users.id, { onDelete: "set null" }),
    completedById: int("completedById").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    completedAt: timestamp("completedAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("disassembly_orders_status_idx").on(table.status, table.createdAt), index("disassembly_orders_source_part_idx").on(table.sourcePartId)],
);

/** Components recovered from a single disassembly; only serviceable lines may be restocked. */
export const disassemblyLines = mysqlTable(
  "disassemblyLines",
  {
    id: int("id").autoincrement().primaryKey(),
    disassemblyOrderId: int("disassemblyOrderId").notNull().references(() => disassemblyOrders.id, { onDelete: "cascade" }),
    recoveredPartId: int("recoveredPartId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    quantityRecovered: int("quantityRecovered").notNull(),
    condition: mysqlEnum("condition", recoveredConditionValues).notNull(),
    inspectionNote: text("inspectionNote"),
    quantityRestocked: int("quantityRestocked").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("disassembly_lines_uq").on(table.disassemblyOrderId, table.recoveredPartId), index("disassembly_lines_part_idx").on(table.recoveredPartId)],
);

export const warehouseReportTypeValues = ["low_stock", "custody_overdue", "maintenance_aging", "count_variances", "open_work_orders", "serial_status"] as const;
export const warehouseReportFrequencyValues = ["daily", "weekly"] as const;

/** Admin-configurable in-app operational report schedule; execution is handled by the existing Heartbeat sweep. */
export const warehouseReportSchedules = mysqlTable(
  "warehouseReportSchedules",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    reportType: mysqlEnum("reportType", warehouseReportTypeValues).notNull(),
    frequency: mysqlEnum("frequency", warehouseReportFrequencyValues).notNull(),
    weekday: int("weekday"),
    runHourUtc: int("runHourUtc").notNull().default(6),
    recipientUserId: int("recipientUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    isActive: int("isActive").notNull().default(1),
    lastRunAt: timestamp("lastRunAt"),
    nextRunAt: timestamp("nextRunAt").notNull(),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("report_schedules_due_idx").on(table.isActive, table.nextRunAt), index("report_schedules_recipient_idx").on(table.recipientUserId)],
);

export const dispensingStatusValues = ["pending", "approved", "rejected", "delivered"] as const;
export const requestFulfillmentTypeValues = ["dispense", "custody"] as const;

/** An engineer's request for one stock part and a specific business purpose. */
export const dispensingRequests = mysqlTable(
  "dispensingRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    requestedById: int("requestedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    requestedQuantity: int("requestedQuantity").notNull(),
    purpose: text("purpose").notNull(),
    fulfillmentType: mysqlEnum("fulfillmentType", requestFulfillmentTypeValues).notNull().default("dispense"),
    custodyDueAt: timestamp("custodyDueAt"),
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

export const custodyStatusValues = ["active", "returned", "cancelled"] as const;

/** An accountable employee custody assignment. It does not deduct physical stock. */
export const custodyAssignments = mysqlTable(
  "custodyAssignments",
  {
    id: int("id").autoincrement().primaryKey(),
    custodyNumber: varchar("custodyNumber", { length: 48 }).notNull().unique(),
    requestId: int("requestId").notNull().unique().references(() => dispensingRequests.id, { onDelete: "restrict" }),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    holderId: int("holderId").notNull().references(() => users.id, { onDelete: "restrict" }),
    issuedById: int("issuedById").references(() => users.id, { onDelete: "set null" }),
    returnedById: int("returnedById").references(() => users.id, { onDelete: "set null" }),
    quantity: int("quantity").notNull(),
    purpose: text("purpose").notNull(),
    dueAt: timestamp("dueAt"),
    status: mysqlEnum("status", custodyStatusValues).notNull().default("active"),
    issuedAt: timestamp("issuedAt").notNull(),
    returnedAt: timestamp("returnedAt"),
    issueNote: text("issueNote"),
    returnNote: text("returnNote"),
    partNumberSnapshot: varchar("partNumberSnapshot", { length: 100 }).notNull(),
    partNameSnapshot: varchar("partNameSnapshot", { length: 200 }).notNull(),
    warehouseSectionSnapshot: mysqlEnum("warehouseSectionSnapshot", warehouseSectionValues).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("custody_holder_status_idx").on(table.holderId, table.status),
    index("custody_part_status_idx").on(table.partId, table.status),
    index("custody_due_idx").on(table.status, table.dueAt),
  ],
);

export const maintenanceCaseTypeValues = ["maintenance_outbound", "customer_return"] as const;
export const maintenanceCaseStatusValues = ["open", "sent_for_maintenance", "awaiting_inspection", "under_diagnosis", "repair_in_progress", "quality_check", "returned_to_stock", "closed", "cancelled"] as const;
export const maintenancePriorityValues = ["low", "normal", "high", "urgent"] as const;
export const maintenanceDispositionValues = ["return_to_stock", "return_to_customer", "cannibalize", "scrap"] as const;

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
    assetSerialNumber: varchar("assetSerialNumber", { length: 160 }),
    externalServiceProvider: varchar("externalServiceProvider", { length: 200 }),
    externalReference: varchar("externalReference", { length: 160 }),
    priority: mysqlEnum("priority", maintenancePriorityValues).notNull().default("normal"),
    outboundCondition: text("outboundCondition"),
    inboundCondition: text("inboundCondition"),
    diagnosis: text("diagnosis"),
    resolutionNote: text("resolutionNote"),
    disposition: mysqlEnum("disposition", maintenanceDispositionValues),
    exitReason: varchar("exitReason", { length: 200 }),
    estimatedCost: int("estimatedCost"),
    actualCost: int("actualCost"),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    dispatchedById: int("dispatchedById").references(() => users.id, { onDelete: "set null" }),
    receivedById: int("receivedById").references(() => users.id, { onDelete: "set null" }),
    sentAt: timestamp("sentAt"),
    returnedAt: timestamp("returnedAt"),
    resolvedAt: timestamp("resolvedAt"),
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

export const printLabPrinterStatusValues = ["available", "printing", "maintenance", "offline"] as const;
export const printLabOrderStatusValues = ["received", "scheduled", "printing", "completed", "delivered", "cancelled"] as const;
export const printLabMaterialMovementTypeValues = ["inbound", "consumed", "returned", "adjustment_in", "adjustment_out"] as const;

/** Machines operated by the Admin inside the dedicated 3D Printing Lab. */
export const printLabPrinters = mysqlTable(
  "printLabPrinters",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull().unique(),
    model: varchar("model", { length: 160 }),
    location: varchar("location", { length: 160 }),
    status: mysqlEnum("status", printLabPrinterStatusValues).notNull().default("available"),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("print_lab_printers_status_idx").on(table.status)],
);

/** One physical filament spool or a controlled material balance, measured in whole grams. */
export const printLabMaterials = mysqlTable(
  "printLabMaterials",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    materialType: varchar("materialType", { length: 80 }).notNull(),
    color: varchar("color", { length: 80 }),
    spoolCode: varchar("spoolCode", { length: 80 }).unique(),
    availableGrams: int("availableGrams").notNull().default(0),
    minimumGrams: int("minimumGrams").notNull().default(0),
    isActive: int("isActive").notNull().default(1),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("print_lab_materials_active_idx").on(table.isActive), index("print_lab_materials_stock_idx").on(table.availableGrams, table.minimumGrams)],
);

/** A printable job tracked from lab intake through handover to its final recipient. */
export const printLabOrders = mysqlTable(
  "printLabOrders",
  {
    id: int("id").autoincrement().primaryKey(),
    orderNumber: varchar("orderNumber", { length: 48 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    receivedFrom: varchar("receivedFrom", { length: 160 }),
    deliveredTo: varchar("deliveredTo", { length: 160 }),
    printerId: int("printerId").references(() => printLabPrinters.id, { onDelete: "set null" }),
    materialId: int("materialId").references(() => printLabMaterials.id, { onDelete: "set null" }),
    expectedGrams: int("expectedGrams").notNull().default(0),
    actualGramsUsed: int("actualGramsUsed").notNull().default(0),
    status: mysqlEnum("status", printLabOrderStatusValues).notNull().default("received"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    deliveredAt: timestamp("deliveredAt"),
    notes: text("notes"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("print_lab_orders_status_idx").on(table.status, table.createdAt), index("print_lab_orders_printer_idx").on(table.printerId, table.status), index("print_lab_orders_material_idx").on(table.materialId)],
);

/** Immutable entry and exit ledger for filament grams in the 3D Printing Lab. */
export const printLabMaterialMovements = mysqlTable(
  "printLabMaterialMovements",
  {
    id: int("id").autoincrement().primaryKey(),
    materialId: int("materialId").notNull().references(() => printLabMaterials.id, { onDelete: "restrict" }),
    orderId: int("orderId").references(() => printLabOrders.id, { onDelete: "set null" }),
    printerId: int("printerId").references(() => printLabPrinters.id, { onDelete: "set null" }),
    type: mysqlEnum("type", printLabMaterialMovementTypeValues).notNull(),
    gramsDelta: int("gramsDelta").notNull(),
    gramsBefore: int("gramsBefore").notNull(),
    gramsAfter: int("gramsAfter").notNull(),
    reason: text("reason").notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("print_lab_movements_material_date_idx").on(table.materialId, table.occurredAt), index("print_lab_movements_order_idx").on(table.orderId), index("print_lab_movements_printer_idx").on(table.printerId)],
);

/** Daily printer log; recording a run consumes the linked filament balance atomically. */
export const printLabRuns = mysqlTable(
  "printLabRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    printerId: int("printerId").notNull().references(() => printLabPrinters.id, { onDelete: "restrict" }),
    orderId: int("orderId").references(() => printLabOrders.id, { onDelete: "set null" }),
    materialId: int("materialId").notNull().references(() => printLabMaterials.id, { onDelete: "restrict" }),
    gramsUsed: int("gramsUsed").notNull(),
    startedAt: timestamp("startedAt").notNull(),
    endedAt: timestamp("endedAt"),
    notes: text("notes"),
    loggedById: int("loggedById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("print_lab_runs_printer_date_idx").on(table.printerId, table.startedAt), index("print_lab_runs_order_idx").on(table.orderId), index("print_lab_runs_material_idx").on(table.materialId)],
);

export const transactionTypeValues = [
  "part_created",
  "part_updated",
  "request_submitted",
  "request_approved",
  "request_rejected",
  "delivery_confirmed",
  "custody_issued",
  "custody_returned",
  "maintenance_dispatched",
  "maintenance_returned",
  "purchase_received",
  "assembly_consumed",
  "assembly_produced",
  "inventory_count_adjusted",
  "work_order_consumed",
  "work_order_produced",
  "disassembly_source_consumed",
  "disassembly_recovered",
] as const;

/** Immutable audit records. A delivery creates the only negative quantity movement. */
export const inventoryTransactions = mysqlTable(
  "inventoryTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    partId: int("partId").notNull().references(() => parts.id, { onDelete: "restrict" }),
    requestId: int("requestId").references(() => dispensingRequests.id, { onDelete: "set null" }),
    custodyAssignmentId: int("custodyAssignmentId").references(() => custodyAssignments.id, { onDelete: "set null" }),
    maintenanceCaseId: int("maintenanceCaseId").references(() => maintenanceCases.id, { onDelete: "set null" }),
    purchaseOrderId: int("purchaseOrderId").references(() => purchaseOrders.id, { onDelete: "set null" }),
    assemblyOrderId: int("assemblyOrderId").references(() => assemblyOrders.id, { onDelete: "set null" }),
    inventoryCountSessionId: int("inventoryCountSessionId").references(() => inventoryCountSessions.id, { onDelete: "set null" }),
    workOrderId: int("workOrderId").references(() => workOrders.id, { onDelete: "set null" }),
    disassemblyOrderId: int("disassemblyOrderId").references(() => disassemblyOrders.id, { onDelete: "set null" }),
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
    index("transactions_custody_idx").on(table.custodyAssignmentId),
    index("transactions_maintenance_idx").on(table.maintenanceCaseId),
    index("transactions_purchase_order_idx").on(table.purchaseOrderId),
    index("transactions_assembly_order_idx").on(table.assemblyOrderId),
    index("transactions_count_session_idx").on(table.inventoryCountSessionId),
    index("transactions_work_order_idx").on(table.workOrderId),
    index("transactions_disassembly_idx").on(table.disassemblyOrderId),
    index("transactions_date_idx").on(table.createdAt),
  ],
);

export const alertTypeValues = ["new_request", "low_stock", "request_approved", "request_rejected", "handover_completed", "overdue_request", "receipt_confirmation_pending", "maintenance_returned", "purchase_received", "assembly_completed", "inventory_count_submitted", "inventory_count_approved", "work_order_completed", "disassembly_completed", "scheduled_report"] as const;

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
    inventoryCountSessionId: int("inventoryCountSessionId").references(() => inventoryCountSessions.id, { onDelete: "set null" }),
    workOrderId: int("workOrderId").references(() => workOrders.id, { onDelete: "set null" }),
    disassemblyOrderId: int("disassemblyOrderId").references(() => disassemblyOrders.id, { onDelete: "set null" }),
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

export const warehouseActivityTypeValues = ["inventory_created", "inventory_updated", "request_submitted", "request_approved", "request_rejected", "handover_completed", "handover_receipt_confirmed", "custody_issued", "custody_returned", "maintenance_dispatched", "maintenance_returned", "maintenance_resolved", "purchase_order_created", "purchase_received", "assembly_completed", "inventory_count_opened", "inventory_count_approved", "work_order_updated", "work_order_completed", "disassembly_completed"] as const;

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
    custodyAssignmentId: int("custodyAssignmentId").references(() => custodyAssignments.id, { onDelete: "set null" }),
    partId: int("partId").references(() => parts.id, { onDelete: "set null" }),
    maintenanceCaseId: int("maintenanceCaseId").references(() => maintenanceCases.id, { onDelete: "set null" }),
    purchaseOrderId: int("purchaseOrderId").references(() => purchaseOrders.id, { onDelete: "set null" }),
    assemblyOrderId: int("assemblyOrderId").references(() => assemblyOrders.id, { onDelete: "set null" }),
    inventoryCountSessionId: int("inventoryCountSessionId").references(() => inventoryCountSessions.id, { onDelete: "set null" }),
    workOrderId: int("workOrderId").references(() => workOrders.id, { onDelete: "set null" }),
    disassemblyOrderId: int("disassemblyOrderId").references(() => disassemblyOrders.id, { onDelete: "set null" }),
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
export type CustodyAssignment = typeof custodyAssignments.$inferSelect;
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
