CREATE TABLE `searchHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(200),
	`orderType` varchar(50),
	`biddingMethod` varchar(100),
	`projectType` varchar(50),
	`categoryCodes` text,
	`rating` varchar(100),
	`organizationCode` varchar(100),
	`location` varchar(200),
	`publicationDateFrom` timestamp,
	`publicationDateTo` timestamp,
	`estimatedPriceMin` decimal(15,2),
	`estimatedPriceMax` decimal(15,2),
	`titleKeyword` varchar(200),
	`constructionNo` varchar(50),
	`useCount` int NOT NULL DEFAULT 1,
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `searchHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `biddings` ADD `rating` varchar(50);--> statement-breakpoint
ALTER TABLE `biddings` ADD `applicationPeriod` varchar(200);--> statement-breakpoint
ALTER TABLE `biddings` ADD `applicationDeadline` timestamp;--> statement-breakpoint
ALTER TABLE `biddings` ADD `hasQuestion` varchar(10);--> statement-breakpoint
ALTER TABLE `biddings` ADD `publicationDate` timestamp;--> statement-breakpoint
ALTER TABLE `biddings` ADD `updateDate` timestamp;--> statement-breakpoint
ALTER TABLE `biddings` ADD `performLocation` text;--> statement-breakpoint
ALTER TABLE `biddings` ADD `remarks` text;--> statement-breakpoint
CREATE INDEX `userId_idx` ON `searchHistory` (`userId`);--> statement-breakpoint
CREATE INDEX `lastUsedAt_idx` ON `searchHistory` (`lastUsedAt`);