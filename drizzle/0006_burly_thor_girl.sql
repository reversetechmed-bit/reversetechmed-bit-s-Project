CREATE TABLE `inventoryCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`colorKey` varchar(24) NOT NULL DEFAULT 'blue',
	`isActive` int NOT NULL DEFAULT 1,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryCategories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `parts` MODIFY COLUMN `category` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `parts` ADD `categoryId` int;--> statement-breakpoint
INSERT IGNORE INTO `inventoryCategories` (`name`, `description`, `colorKey`, `isActive`) VALUES ('طبي', 'تصنيف افتراضي للمنتجات والمكونات الطبية.', 'sky', 1), ('إمبيديد', 'تصنيف افتراضي للأنظمة المضمنة.', 'violet', 1), ('إلكترونيات', 'تصنيف افتراضي للمكونات الإلكترونية.', 'amber', 1), ('لوحات', 'تصنيف افتراضي للوحات والدوائر المطبوعة.', 'emerald', 1);--> statement-breakpoint
UPDATE `parts` SET `category` = CASE `category` WHEN 'Medical' THEN 'طبي' WHEN 'Embedded' THEN 'إمبيديد' WHEN 'Electronics' THEN 'إلكترونيات' WHEN 'Boards' THEN 'لوحات' ELSE `category` END;--> statement-breakpoint
UPDATE `parts` INNER JOIN `inventoryCategories` ON `parts`.`category` = `inventoryCategories`.`name` SET `parts`.`categoryId` = `inventoryCategories`.`id`;--> statement-breakpoint
ALTER TABLE `inventoryCategories` ADD CONSTRAINT `inventoryCategories_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `inventoryCategories_active_name_idx` ON `inventoryCategories` (`isActive`,`name`);--> statement-breakpoint
ALTER TABLE `parts` ADD CONSTRAINT `parts_categoryId_inventoryCategories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `inventoryCategories`(`id`) ON DELETE set null ON UPDATE no action;
