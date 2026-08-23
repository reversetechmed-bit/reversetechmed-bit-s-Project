ALTER TABLE `inventoryTransactions` MODIFY COLUMN `type` enum('part_created','part_updated','request_submitted','request_approved','request_rejected','delivery_confirmed','custody_issued','custody_returned','maintenance_dispatched','maintenance_returned','purchase_received','assembly_consumed','assembly_produced','inventory_count_adjusted','work_order_consumed','work_order_produced','disassembly_source_consumed','disassembly_recovered') NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouseActivities` MODIFY COLUMN `type` enum('inventory_created','inventory_updated','request_submitted','request_approved','request_rejected','handover_completed','handover_receipt_confirmed','custody_issued','custody_returned','maintenance_dispatched','maintenance_returned','maintenance_resolved','purchase_order_created','purchase_received','assembly_completed','inventory_count_opened','inventory_count_approved','work_order_updated','work_order_completed','disassembly_completed') NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` MODIFY COLUMN `type` enum('new_request','low_stock','request_approved','request_rejected','handover_completed','overdue_request','receipt_confirmation_pending','maintenance_returned','purchase_received','assembly_completed','inventory_count_submitted','inventory_count_approved','work_order_completed','disassembly_completed','scheduled_report') NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `inventoryCountSessionId` int;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `workOrderId` int;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `disassemblyOrderId` int;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD `inventoryCountSessionId` int;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD `workOrderId` int;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD `disassemblyOrderId` int;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD `inventoryCountSessionId` int;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD `workOrderId` int;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD `disassemblyOrderId` int;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inv_tx_count_fk` FOREIGN KEY (`inventoryCountSessionId`) REFERENCES `inventoryCountSessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inv_tx_work_fk` FOREIGN KEY (`workOrderId`) REFERENCES `workOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inv_tx_disassembly_fk` FOREIGN KEY (`disassemblyOrderId`) REFERENCES `disassemblyOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `act_count_fk` FOREIGN KEY (`inventoryCountSessionId`) REFERENCES `inventoryCountSessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `act_work_fk` FOREIGN KEY (`workOrderId`) REFERENCES `workOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseActivities` ADD CONSTRAINT `act_disassembly_fk` FOREIGN KEY (`disassemblyOrderId`) REFERENCES `disassemblyOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `alert_count_fk` FOREIGN KEY (`inventoryCountSessionId`) REFERENCES `inventoryCountSessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `alert_work_fk` FOREIGN KEY (`workOrderId`) REFERENCES `workOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `alert_disassembly_fk` FOREIGN KEY (`disassemblyOrderId`) REFERENCES `disassemblyOrders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `transactions_count_session_idx` ON `inventoryTransactions` (`inventoryCountSessionId`);--> statement-breakpoint
CREATE INDEX `transactions_work_order_idx` ON `inventoryTransactions` (`workOrderId`);--> statement-breakpoint
CREATE INDEX `transactions_disassembly_idx` ON `inventoryTransactions` (`disassemblyOrderId`);
