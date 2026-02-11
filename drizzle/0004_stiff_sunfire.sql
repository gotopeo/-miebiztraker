CREATE TABLE `lineConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lineUserId` varchar(100) NOT NULL,
	`lineDisplayName` varchar(200),
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`lastNotifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lineConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `lineConnections_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `lineConnections_lineUserId_unique` UNIQUE(`lineUserId`)
);
--> statement-breakpoint
CREATE TABLE `lineVerificationCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(6) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lineVerificationCodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `lineVerificationCodes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `notificationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subscriptionId` int NOT NULL,
	`biddingCount` int NOT NULL,
	`biddingIds` text,
	`status` enum('success','failed') NOT NULL,
	`errorMessage` text,
	`notifiedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificationLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`orderOrganCodes` text,
	`publicationDateDays` int,
	`updateDateDays` int,
	`keywords` text,
	`ratings` varchar(100),
	`estimatedPriceMin` decimal(15,2),
	`estimatedPriceMax` decimal(15,2),
	`notificationTimes` varchar(200) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`lastNotifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationSubscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `lineConnections` (`userId`);--> statement-breakpoint
CREATE INDEX `lineUserId_idx` ON `lineConnections` (`lineUserId`);--> statement-breakpoint
CREATE INDEX `code_idx` ON `lineVerificationCodes` (`code`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `lineVerificationCodes` (`userId`);--> statement-breakpoint
CREATE INDEX `expiresAt_idx` ON `lineVerificationCodes` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `notificationLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `subscriptionId_idx` ON `notificationLogs` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `notifiedAt_idx` ON `notificationLogs` (`notifiedAt`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `notificationSubscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `enabled_idx` ON `notificationSubscriptions` (`enabled`);