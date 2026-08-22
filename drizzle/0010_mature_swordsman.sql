CREATE TABLE `warehouseAutomationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(64) NOT NULL,
	`isEnabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouseAutomationSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouseAutomationSettings_settingKey_unique` UNIQUE(`settingKey`),
	CONSTRAINT `warehouseAutomationSettings_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE INDEX `warehouse_automation_enabled_idx` ON `warehouseAutomationSettings` (`isEnabled`);