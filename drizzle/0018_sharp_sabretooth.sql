CREATE TABLE `disassemblyLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`disassemblyOrderId` int NOT NULL,
	`recoveredPartId` int NOT NULL,
	`quantityRecovered` int NOT NULL,
	`condition` enum('serviceable','quarantine','scrap') NOT NULL,
	`inspectionNote` text,
	`quantityRestocked` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `disassemblyLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `disassembly_lines_uq` UNIQUE(`disassemblyOrderId`,`recoveredPartId`)
);
--> statement-breakpoint
CREATE TABLE `disassemblyOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`disassemblyNumber` varchar(48) NOT NULL,
	`status` enum('draft','submitted','approved','completed','cancelled') NOT NULL DEFAULT 'draft',
	`sourcePartId` int,
	`sourceSerialAssetId` int,
	`sourceMaintenanceCaseId` int,
	`reason` text NOT NULL,
	`createdById` int,
	`approvedById` int,
	`completedById` int,
	`approvedAt` timestamp,
	`completedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `disassemblyOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `disassemblyOrders_disassemblyNumber_unique` UNIQUE(`disassemblyNumber`),
	CONSTRAINT `disassemblyOrders_sourceSerialAssetId_unique` UNIQUE(`sourceSerialAssetId`)
);
--> statement-breakpoint
CREATE TABLE `inventoryCountLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`partId` int NOT NULL,
	`expectedQuantity` int NOT NULL,
	`expectedReservedQuantity` int NOT NULL DEFAULT 0,
	`expectedCustodyQuantity` int NOT NULL DEFAULT 0,
	`countedQuantity` int,
	`varianceQuantity` int,
	`discrepancyReason` text,
	`countedById` int,
	`countedAt` timestamp,
	`partNumberSnapshot` varchar(100) NOT NULL,
	`partNameSnapshot` varchar(200) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryCountLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `count_lines_session_part_uq` UNIQUE(`sessionId`,`partId`)
);
--> statement-breakpoint
CREATE TABLE `inventoryCountSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`countNumber` varchar(48) NOT NULL,
	`status` enum('draft','open','submitted','approved','cancelled') NOT NULL DEFAULT 'draft',
	`warehouseSection` enum('components','products'),
	`openedById` int,
	`submittedById` int,
	`approvedById` int,
	`openedAt` timestamp,
	`submittedAt` timestamp,
	`approvedAt` timestamp,
	`notes` text,
	`approvalNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryCountSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryCountSessions_countNumber_unique` UNIQUE(`countNumber`)
);
--> statement-breakpoint
CREATE TABLE `serialAssetEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serialAssetId` int NOT NULL,
	`type` enum('registered','moved','custody_issued','custody_returned','maintenance_opened','work_started','work_completed','installed','disassembled','retired') NOT NULL,
	`fromStatus` enum('in_stock','in_custody','in_maintenance','in_production','installed','retired','cannibalized','scrapped'),
	`toStatus` enum('in_stock','in_custody','in_maintenance','in_production','installed','retired','cannibalized','scrapped'),
	`locationId` int,
	`holderId` int,
	`actorId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `serialAssetEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serialAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serialNumber` varchar(160) NOT NULL,
	`partId` int NOT NULL,
	`status` enum('in_stock','in_custody','in_maintenance','in_production','installed','retired','cannibalized','scrapped') NOT NULL DEFAULT 'in_stock',
	`locationId` int,
	`currentHolderId` int,
	`assetCondition` varchar(160),
	`manufacturerSerial` varchar(160),
	`acquiredAt` timestamp,
	`notes` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serialAssets_id` PRIMARY KEY(`id`),
	CONSTRAINT `serialAssets_serialNumber_unique` UNIQUE(`serialNumber`)
);
--> statement-breakpoint
CREATE TABLE `storageLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`barcode` varchar(100) NOT NULL,
	`shelf` varchar(80),
	`drawer` varchar(80),
	`box` varchar(80),
	`notes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storageLocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `storageLocations_code_unique` UNIQUE(`code`),
	CONSTRAINT `storageLocations_barcode_unique` UNIQUE(`barcode`)
);
--> statement-breakpoint
CREATE TABLE `warehouseReportSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`reportType` enum('low_stock','custody_overdue','maintenance_aging','count_variances','open_work_orders','serial_status') NOT NULL,
	`frequency` enum('daily','weekly') NOT NULL,
	`weekday` int,
	`runHourUtc` int NOT NULL DEFAULT 6,
	`recipientUserId` int NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp NOT NULL,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouseReportSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workOrderLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workOrderId` int NOT NULL,
	`sourcePartId` int NOT NULL,
	`quantityPerUnit` int NOT NULL,
	`quantityRequired` int NOT NULL,
	`quantityConsumed` int NOT NULL DEFAULT 0,
	`partNumberSnapshot` varchar(100) NOT NULL,
	`partNameSnapshot` varchar(200) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workOrderLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_order_lines_uq` UNIQUE(`workOrderId`,`sourcePartId`)
);
--> statement-breakpoint
CREATE TABLE `workOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workOrderNumber` varchar(48) NOT NULL,
	`type` enum('production','repair') NOT NULL,
	`status` enum('draft','released','in_progress','quality_check','completed','cancelled') NOT NULL DEFAULT 'draft',
	`targetPartId` int NOT NULL,
	`serialAssetId` int,
	`quantityPlanned` int NOT NULL DEFAULT 1,
	`assigneeId` int,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`dueAt` timestamp,
	`releasedAt` timestamp,
	`startedAt` timestamp,
	`qualityCheckedById` int,
	`qualityCheckedAt` timestamp,
	`qualityOutcome` varchar(64),
	`completedById` int,
	`completedAt` timestamp,
	`notes` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `workOrders_workOrderNumber_unique` UNIQUE(`workOrderNumber`)
);
--> statement-breakpoint
ALTER TABLE `employeeProfiles` MODIFY COLUMN `warehouseRole` enum('admin','engineer','viewer','storekeeper','maintenance_technician','purchasing_officer') NOT NULL DEFAULT 'engineer';--> statement-breakpoint
ALTER TABLE `parts` ADD `barcode` varchar(100);--> statement-breakpoint
ALTER TABLE `parts` ADD `serialTrackingMode` enum('none','serial') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `parts` ADD CONSTRAINT `parts_barcode_unique` UNIQUE(`barcode`);--> statement-breakpoint
ALTER TABLE `disassemblyLines` ADD CONSTRAINT `ds_line_order_fk` FOREIGN KEY (`disassemblyOrderId`) REFERENCES `disassemblyOrders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disassemblyLines` ADD CONSTRAINT `ds_line_part_fk` FOREIGN KEY (`recoveredPartId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disassemblyOrders` ADD CONSTRAINT `ds_order_part_fk` FOREIGN KEY (`sourcePartId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disassemblyOrders` ADD CONSTRAINT `ds_order_asset_fk` FOREIGN KEY (`sourceSerialAssetId`) REFERENCES `serialAssets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disassemblyOrders` ADD CONSTRAINT `ds_order_case_fk` FOREIGN KEY (`sourceMaintenanceCaseId`) REFERENCES `maintenanceCases`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disassemblyOrders` ADD CONSTRAINT `ds_order_creator_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disassemblyOrders` ADD CONSTRAINT `ds_order_approver_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disassemblyOrders` ADD CONSTRAINT `ds_order_completer_fk` FOREIGN KEY (`completedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryCountLines` ADD CONSTRAINT `cnt_line_session_fk` FOREIGN KEY (`sessionId`) REFERENCES `inventoryCountSessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryCountLines` ADD CONSTRAINT `cnt_line_part_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryCountLines` ADD CONSTRAINT `cnt_line_counter_fk` FOREIGN KEY (`countedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryCountSessions` ADD CONSTRAINT `cnt_session_open_fk` FOREIGN KEY (`openedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryCountSessions` ADD CONSTRAINT `cnt_session_submit_fk` FOREIGN KEY (`submittedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryCountSessions` ADD CONSTRAINT `cnt_session_approve_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serialAssetEvents` ADD CONSTRAINT `serial_evt_asset_fk` FOREIGN KEY (`serialAssetId`) REFERENCES `serialAssets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serialAssetEvents` ADD CONSTRAINT `serial_evt_location_fk` FOREIGN KEY (`locationId`) REFERENCES `storageLocations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serialAssetEvents` ADD CONSTRAINT `serial_evt_holder_fk` FOREIGN KEY (`holderId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serialAssetEvents` ADD CONSTRAINT `serial_evt_actor_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serialAssets` ADD CONSTRAINT `serial_asset_part_fk` FOREIGN KEY (`partId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serialAssets` ADD CONSTRAINT `serial_asset_location_fk` FOREIGN KEY (`locationId`) REFERENCES `storageLocations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serialAssets` ADD CONSTRAINT `serial_asset_holder_fk` FOREIGN KEY (`currentHolderId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serialAssets` ADD CONSTRAINT `serial_asset_creator_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storageLocations` ADD CONSTRAINT `store_location_creator_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseReportSchedules` ADD CONSTRAINT `report_recipient_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseReportSchedules` ADD CONSTRAINT `report_creator_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrderLines` ADD CONSTRAINT `wo_line_order_fk` FOREIGN KEY (`workOrderId`) REFERENCES `workOrders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrderLines` ADD CONSTRAINT `wo_line_part_fk` FOREIGN KEY (`sourcePartId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrders` ADD CONSTRAINT `wo_target_part_fk` FOREIGN KEY (`targetPartId`) REFERENCES `parts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrders` ADD CONSTRAINT `wo_asset_fk` FOREIGN KEY (`serialAssetId`) REFERENCES `serialAssets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrders` ADD CONSTRAINT `wo_assignee_fk` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrders` ADD CONSTRAINT `wo_qc_fk` FOREIGN KEY (`qualityCheckedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrders` ADD CONSTRAINT `wo_completer_fk` FOREIGN KEY (`completedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workOrders` ADD CONSTRAINT `wo_creator_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `disassembly_lines_part_idx` ON `disassemblyLines` (`recoveredPartId`);--> statement-breakpoint
CREATE INDEX `disassembly_orders_status_idx` ON `disassemblyOrders` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `disassembly_orders_source_part_idx` ON `disassemblyOrders` (`sourcePartId`);--> statement-breakpoint
CREATE INDEX `count_lines_part_idx` ON `inventoryCountLines` (`partId`);--> statement-breakpoint
CREATE INDEX `count_sessions_status_idx` ON `inventoryCountSessions` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `count_sessions_section_idx` ON `inventoryCountSessions` (`warehouseSection`);--> statement-breakpoint
CREATE INDEX `serial_asset_events_asset_idx` ON `serialAssetEvents` (`serialAssetId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `serial_assets_part_status_idx` ON `serialAssets` (`partId`,`status`);--> statement-breakpoint
CREATE INDEX `serial_assets_holder_idx` ON `serialAssets` (`currentHolderId`);--> statement-breakpoint
CREATE INDEX `serial_assets_location_idx` ON `serialAssets` (`locationId`);--> statement-breakpoint
CREATE INDEX `storage_locations_active_idx` ON `storageLocations` (`isActive`);--> statement-breakpoint
CREATE INDEX `storage_locations_barcode_idx` ON `storageLocations` (`barcode`);--> statement-breakpoint
CREATE INDEX `report_schedules_due_idx` ON `warehouseReportSchedules` (`isActive`,`nextRunAt`);--> statement-breakpoint
CREATE INDEX `report_schedules_recipient_idx` ON `warehouseReportSchedules` (`recipientUserId`);--> statement-breakpoint
CREATE INDEX `work_orders_status_idx` ON `workOrders` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `work_orders_assignee_idx` ON `workOrders` (`assigneeId`,`status`);--> statement-breakpoint
CREATE INDEX `work_orders_target_idx` ON `workOrders` (`targetPartId`);--> statement-breakpoint
CREATE INDEX `parts_barcode_idx` ON `parts` (`barcode`);
