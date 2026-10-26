-- Phase 4: lifecycle event ledger, milestones, in-app notifications, amendments and closure records.
ALTER TABLE `ContractVersion` ADD COLUMN `previousHash` VARCHAR(191) NULL;

CREATE TABLE `ContractEvent` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NULL,
  `actorRole` VARCHAR(191) NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `fromStatus` VARCHAR(191) NULL,
  `toStatus` VARCHAR(191) NULL,
  `summary` TEXT NOT NULL,
  `metadata` JSON NULL,
  `previousHash` VARCHAR(191) NULL,
  `eventHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ContractEvent_eventHash_key` (`eventHash`),
  INDEX `ContractEvent_contractId_createdAt_idx` (`contractId`, `createdAt`),
  INDEX `ContractEvent_eventType_createdAt_idx` (`eventType`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractEvent_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractMilestone` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `dueAt` DATETIME(3) NULL,
  `status` ENUM('PENDING','IN_PROGRESS','COMPLETED','BLOCKED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `required` BOOLEAN NOT NULL DEFAULT true,
  `completedAt` DATETIME(3) NULL,
  `completedById` VARCHAR(191) NULL,
  `evidence` JSON NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ContractMilestone_contractId_status_idx` (`contractId`, `status`),
  INDEX `ContractMilestone_dueAt_status_idx` (`dueAt`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractMilestone_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractNotification` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ContractNotification_userId_readAt_createdAt_idx` (`userId`, `readAt`, `createdAt`),
  INDEX `ContractNotification_contractId_createdAt_idx` (`contractId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ContractNotification_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractAmendment` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `amendmentNo` INTEGER NOT NULL,
  `baseVersion` INTEGER NOT NULL,
  `proposedContent` JSON NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','APPLIED') NOT NULL DEFAULT 'DRAFT',
  `createdById` VARCHAR(191) NOT NULL,
  `submittedAt` DATETIME(3) NULL,
  `reviewedById` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `reviewNote` TEXT NULL,
  `appliedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ContractAmendment_contractId_amendmentNo_key` (`contractId`, `amendmentNo`),
  INDEX `ContractAmendment_contractId_status_idx` (`contractId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractAmendment_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractClosure` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `closedById` VARCHAR(191) NOT NULL,
  `closureType` VARCHAR(191) NOT NULL,
  `finalContentHash` VARCHAR(191) NOT NULL,
  `notes` TEXT NOT NULL,
  `evidence` JSON NULL,
  `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ContractClosure_contractId_key` (`contractId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractClosure_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
