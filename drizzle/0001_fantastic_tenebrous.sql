CREATE TABLE `biddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseNumber` varchar(100) NOT NULL,
	`title` text NOT NULL,
	`orderOrganCode` varchar(50),
	`orderOrganName` text,
	`biddingDate` timestamp,
	`openingDate` timestamp,
	`estimatedPrice` decimal(15,2),
	`minimumPrice` decimal(15,2),
	`biddingMethod` varchar(100),
	`constructionType` varchar(100),
	`location` text,
	`constructionPeriod` varchar(200),
	`status` varchar(50),
	`detailUrl` text,
	`rawData` text,
	`isNew` boolean NOT NULL DEFAULT true,
	`notified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `biddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keywordWatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`keyword` varchar(200) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `keywordWatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduleSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`scheduleType` enum('daily','weekly','custom') NOT NULL,
	`executionTime` varchar(5) NOT NULL,
	`daysOfWeek` varchar(20),
	`cronExpression` varchar(100),
	`enabled` boolean NOT NULL DEFAULT true,
	`lastExecutedAt` timestamp,
	`nextExecutionAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduleSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scrapingLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`executionType` enum('manual','scheduled') NOT NULL,
	`startedAt` timestamp NOT NULL,
	`finishedAt` timestamp,
	`status` enum('running','success','failed') NOT NULL,
	`itemsScraped` int DEFAULT 0,
	`newItems` int DEFAULT 0,
	`errorMessage` text,
	`errorDetails` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scrapingLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `caseNumber_idx` ON `biddings` (`caseNumber`);--> statement-breakpoint
CREATE INDEX `biddingDate_idx` ON `biddings` (`biddingDate`);--> statement-breakpoint
CREATE INDEX `orderOrganCode_idx` ON `biddings` (`orderOrganCode`);--> statement-breakpoint
CREATE INDEX `isNew_idx` ON `biddings` (`isNew`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `keywordWatches` (`userId`);--> statement-breakpoint
CREATE INDEX `startedAt_idx` ON `scrapingLogs` (`startedAt`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `scrapingLogs` (`status`);