ALTER TABLE `Contract`
  ADD COLUMN `templateId` VARCHAR(191) NULL,
  ADD INDEX `Contract_templateId_idx` (`templateId`);

CREATE TABLE `ContractTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `commodity` VARCHAR(191) NULL,
  `language` VARCHAR(191) NOT NULL DEFAULT 'en',
  `version` INTEGER NOT NULL DEFAULT 1,
  `clauses` JSON NOT NULL,
  `status` ENUM('DRAFT','APPROVED','RETIRED') NOT NULL DEFAULT 'DRAFT',
  `createdById` VARCHAR(191) NOT NULL,
  `approvedById` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ContractTemplate_status_commodity_idx` (`status`, `commodity`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Contract`
  ADD CONSTRAINT `Contract_templateId_fkey`
  FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `ContractComment` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `authorId` VARCHAR(191) NOT NULL,
  `clauseKey` VARCHAR(191) NULL,
  `body` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ContractComment_contractId_createdAt_idx` (`contractId`, `createdAt`),
  INDEX `ContractComment_authorId_idx` (`authorId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractComment_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractAnnex` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `content` JSON NULL,
  `fileName` VARCHAR(191) NULL,
  `mimeType` VARCHAR(191) NULL,
  `storageUrl` VARCHAR(191) NULL,
  `checksum` VARCHAR(191) NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ContractAnnex_contractId_createdAt_idx` (`contractId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractAnnex_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractChangeAcceptance` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `accepted` BOOLEAN NOT NULL,
  `comment` VARCHAR(191) NULL,
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ContractChangeAcceptance_contractId_version_userId_key` (`contractId`, `version`, `userId`),
  INDEX `ContractChangeAcceptance_userId_accepted_idx` (`userId`, `accepted`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractChangeAcceptance_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
