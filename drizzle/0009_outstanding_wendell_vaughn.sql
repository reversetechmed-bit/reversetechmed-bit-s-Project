CREATE TABLE `assemblyOrderLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assemblyOrderId` int NOT NULL,
	`sourcePartId` int NOT NULL,
	`quantityPerUnit` int NOT NULL,
	`quantityConsumed` int NOT NULL,
	`partNumberSnapshot` varchar(100) NOT NULL,
	`partNameSnapshot` varchar(200) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assemblyOrderLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `assembly_order_lines_unique_idx` UNIQUE(`assemblyOrderId`,`sourcePartId`)
);
--> statement-breakpoint
CREATE TABLE `assemblyOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assemblyNumber` varchar(48) NOT NULL,
	`targetProductId` int NOT NULL,
	`quantityToProduce` int NOT NULL,
	`status` enum('draft','completed','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdById` int,
	`completedById` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assemblyOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `assemblyOrders_assemblyNumber_unique` UNIQUE(`assemblyNumber`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceCases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseNumber` varchar(48) NOT NULL,
	`type` enum('maintenance_outbound','customer_return') NOT NULL,
	`status` enum('open','sent_for_maintenance','awaiting_inspection','returned_to_stock','closed','cancelled') NOT NULL DEFAULT 'open',
	`partId` int NOT NULL,
	`quantity` int NOT NULL,
	`customerName` varchar(200),
	`customerReference` varchar(160),
	`outboundCondition` text,
	`inboundCondition` text,
	`notes` text,
	`createdById` int,
	`dispatchedById` int,
	`receivedById` int,
	`sentAt` timestamp,
	`returnedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenanceCases_id` PRIMARY KEY(`id`),
	CONSTRAINT `maintenanceCases_caseNumber_unique` UNIQUE(`caseNumber`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrderLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`partId` int NOT NULL,
	`quantityOrdered` int NOT NULL,
	`quantityReceived` int NOT NULL DEFAULT 0,
	`shortageQuantitySnapshot` int,
	`shortageReason` varchar(240),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrderLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_order_lines_unique_idx` UNIQUE(`purchaseOrderId`,`partId`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(48) NOT NULL,
	`supplierCompanyId` int NOT NULL,
	`status` enum('draft','ordered','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
	`expectedAt` timestamp,
	`orderedAt` timestamp,
	`receivedAt` timestamp,
	`notes` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseOrders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
ALTER TABLE `inventoryTransactions` MODIFY COLUMN `type` enum('part_created','part_updated','request_submitted','request_approved','request_rejected','delivery_confirmed','maintenance_dispatched','maintenance_returned','purchase_received','assembly_consumed','assembly_produced') NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouseActivities` MODIFY COLUMN `type` enum('inventory_created','inventory_updated','request_submitted','request_approved','request_rejected','handover_completed','handover_receipt_confirmed','maintenance_dispatched','maintenance_returned','purchase_order_created','purchase_received','assembly_completed') NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` MODIFY COLUMN `type` enum('new_request','low_stock','request_approved','request_rejected','handover_completed','overdue_request','receipt_confirmation_pending','maintenance_returned','purchase_received','assembly_completed') NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `maintenanceCaseId` int;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `purchaseOrderId` int;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `assemblyOrderId` int;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD `maintenanceCaseId` int;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD `purchaseOrderId` int;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD `assemblyOrderId` int;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD `maintenanceCaseId` int;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD `purchaseOrderId` int;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD `assemblyOrderId` int;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD `dedupeKey` varchar(160);--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `warehouseAlerts_dedupeKey_unique` UNIQUE(`dedupeKey`);--> statement-breakpoint
ALTER TABLE `assemblyOrderLines` ADD CONSTRAINT `assemblyOrderLines_assemblyOrderId_assemblyOrders_id_fk` FOREIGN KEY (`assemblyOrderId`) REFERENCES `assemblyOrders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assemblyOrderLines` ADD CONSTRAINT `assemblyOrderLines_sourcePartId_parts_id_fk` FOREIGN KEY (`sourcePartId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assemblyOrders` ADD CONSTRAINT `assemblyOrders_targetProductId_parts_id_fk` FOREIGN KEY (`targetProductId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assemblyOrders` ADD CONSTRAINT `assemblyOrders_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assemblyOrders` ADD CONSTRAINT `assemblyOrders_completedById_users_id_fk` FOREIGN KEY (`completedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD CONSTRAINT `maintenanceCases_partId_parts_id_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD CONSTRAINT `maintenanceCases_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD CONSTRAINT `maintenanceCases_dispatchedById_users_id_fk` FOREIGN KEY (`dispatchedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenanceCases` ADD CONSTRAINT `maintenanceCases_receivedById_users_id_fk` FOREIGN KEY (`receivedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrderLines` ADD CONSTRAINT `purchaseOrderLines_purchaseOrderId_purchaseOrders_id_fk` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchaseOrders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrderLines` ADD CONSTRAINT `purchaseOrderLines_partId_parts_id_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD CONSTRAINT `purchaseOrders_supplierCompanyId_companies_id_fk` FOREIGN KEY (`supplierCompanyId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD CONSTRAINT `purchaseOrders_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assembly_orders_status_idx` ON `assemblyOrders` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `assembly_orders_target_idx` ON `assemblyOrders` (`targetProductId`);--> statement-breakpoint
CREATE INDEX `maintenance_cases_status_idx` ON `maintenanceCases` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `maintenance_cases_part_idx` ON `maintenanceCases` (`partId`);--> statement-breakpoint
CREATE INDEX `purchase_order_lines_part_idx` ON `purchaseOrderLines` (`partId`);--> statement-breakpoint
CREATE INDEX `purchase_orders_status_idx` ON `purchaseOrders` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `purchase_orders_supplier_idx` ON `purchaseOrders` (`supplierCompanyId`);--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inventoryTransactions_maintenanceCaseId_maintenanceCases_id_fk` FOREIGN KEY (`maintenanceCaseId`) REFERENCES `maintenanceCases`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inventoryTransactions_purchaseOrderId_purchaseOrders_id_fk` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchaseOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inventoryTransactions_assemblyOrderId_assemblyOrders_id_fk` FOREIGN KEY (`assemblyOrderId`) REFERENCES `assemblyOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `warehouseActivities_maintenanceCaseId_maintenanceCases_id_fk` FOREIGN KEY (`maintenanceCaseId`) REFERENCES `maintenanceCases`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `warehouseActivities_purchaseOrderId_purchaseOrders_id_fk` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchaseOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `warehouseActivities_assemblyOrderId_assemblyOrders_id_fk` FOREIGN KEY (`assemblyOrderId`) REFERENCES `assemblyOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `warehouseAlerts_maintenanceCaseId_maintenanceCases_id_fk` FOREIGN KEY (`maintenanceCaseId`) REFERENCES `maintenanceCases`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `warehouseAlerts_purchaseOrderId_purchaseOrders_id_fk` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchaseOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `warehouseAlerts_assemblyOrderId_assemblyOrders_id_fk` FOREIGN KEY (`assemblyOrderId`) REFERENCES `assemblyOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `transactions_maintenance_idx` ON `inventoryTransactions` (`maintenanceCaseId`);--> statement-breakpoint
CREATE INDEX `transactions_purchase_order_idx` ON `inventoryTransactions` (`purchaseOrderId`);--> statement-breakpoint
CREATE INDEX `transactions_assembly_order_idx` ON `inventoryTransactions` (`assemblyOrderId`);--> statement-breakpoint
CREATE INDEX `alerts_type_part_idx` ON `warehouseAlerts` (`type`,`partId`);