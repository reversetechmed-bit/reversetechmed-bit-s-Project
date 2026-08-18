ALTER TABLE `warehouseAlerts` MODIFY COLUMN `type` enum('new_request','low_stock','request_approved','request_rejected','handover_completed') NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD `recipientUserId` int;--> statement-breakpoint
ALTER TABLE `warehouseAlerts` ADD CONSTRAINT `warehouseAlerts_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `alerts_recipient_idx` ON `warehouseAlerts` (`recipientUserId`,`isRead`);