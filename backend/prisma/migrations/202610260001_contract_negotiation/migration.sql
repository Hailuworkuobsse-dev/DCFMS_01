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
  `comment` TEXT NULL,
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ContractChangeAcceptance_contractId_version_userId_key` (`contractId`, `version`, `userId`),
  INDEX `ContractChangeAcceptance_userId_accepted_idx` (`userId`, `accepted`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractChangeAcceptance_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ContractTemplate`
  (`id`, `title`, `description`, `commodity`, `language`, `version`, `clauses`, `status`, `createdById`, `approvedById`, `approvedAt`, `createdAt`, `updatedAt`)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'Standard Contract Farming Agreement',
    'Initial approved template. Legal text should be reviewed by authorized counsel before production deployment.',
    NULL,
    'en',
    1,
    JSON_ARRAY(
      JSON_OBJECT('key','purpose','title','Purpose and parties','text','The parties agree to produce and supply the commodity under the terms in this agreement.','mandatory',true,'editable',false),
      JSON_OBJECT('key','quantity','title','Quantity and unit','text','Quantity and unit to be agreed by the parties.','mandatory',true,'editable',true),
      JSON_OBJECT('key','quality','title','Quality requirements','text','Quality grades and acceptance criteria to be completed by the parties.','mandatory',true,'editable',true),
      JSON_OBJECT('key','price','title','Price and payment','text','Price mechanism, price, deductions, and payment timing to be agreed by the parties.','mandatory',true,'editable',true),
      JSON_OBJECT('key','delivery','title','Delivery schedule and location','text','Delivery dates, destination, and acceptance procedure to be agreed by the parties.','mandatory',true,'editable',true),
      JSON_OBJECT('key','inputs','title','Inputs and support','text','Input advances and support obligations to be specified where applicable.','mandatory',false,'editable',true),
      JSON_OBJECT('key','disputes','title','Dispute resolution','text','The parties will first use the applicable statutory mediation and dispute-resolution process.','mandatory',true,'editable',false)
    ),
    'APPROVED',
    'system-seed',
    'system-seed',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
  );
