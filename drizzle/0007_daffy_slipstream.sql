ALTER TABLE `notificationLogs` DROP INDEX `unique_notification_idx`;--> statement-breakpoint
ALTER TABLE `biddings` MODIFY COLUMN `updatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `biddings` ADD `version` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notificationLogs` ADD `tenderVersion` int;--> statement-breakpoint
ALTER TABLE `notificationLogs` ADD CONSTRAINT `unique_new_notification_idx` UNIQUE(`userId`,`subscriptionId`,`tenderCanonicalId`,`notificationType`);--> statement-breakpoint
ALTER TABLE `notificationLogs` ADD CONSTRAINT `unique_update_notification_idx` UNIQUE(`userId`,`subscriptionId`,`tenderCanonicalId`,`notificationType`,`tenderVersion`);