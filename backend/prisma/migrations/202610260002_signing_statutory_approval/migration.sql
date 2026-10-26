-- Phase 3: signing evidence, authority verification metadata and statutory review decisions.
ALTER TABLE `Contract`
  MODIFY COLUMN `status` ENUM('DRAFT','PENDING_SIGNATURES','SIGNED','PENDING_APPROVAL','APPROVED','IN_EXECUTION','COMPLETED','ADJUSTED','REJECTED','RETURNED_FOR_CORRECTION','CANCELLED') NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `Signature`
  ADD COLUMN `contentHashAtSigning` VARCHAR(191) NULL,
  ADD COLUMN `otpVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `authorityVerified` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `SignatureEvidence` (
  `id` VARCHAR(191) NOT NULL,
  `signatureId` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `signerId` VARCHAR(191) NOT NULL,
  `signerRole` VARCHAR(191) NOT NULL,
  `method` ENUM('OTP','FAYDAPASS','MANUAL') NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `signatureHash` VARCHAR(191) NOT NULL,
  `authorityBasis` VARCHAR(191) NOT NULL,
  `authorityReference` VARCHAR(191) NULL,
  `otpVerifiedAt` DATETIME(3) NULL,
  `signedAt` DATETIME(3) NOT NULL,
  `ipAddress` VARCHAR(191) NULL,
  `userAgent` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SignatureEvidence_signatureId_key` (`signatureId`),
  UNIQUE INDEX `SignatureEvidence_signatureHash_key` (`signatureHash`),
  INDEX `SignatureEvidence_contractId_signedAt_idx` (`contractId`, `signedAt`),
  INDEX `SignatureEvidence_signerId_signedAt_idx` (`signerId`, `signedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SignatureEvidence_signatureId_fkey` FOREIGN KEY (`signatureId`) REFERENCES `Signature`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractSignatoryAuthority` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `authorityType` VARCHAR(191) NOT NULL,
  `referenceNumber` VARCHAR(191) NOT NULL,
  `evidenceHash` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `verifiedById` VARCHAR(191) NULL,
  `verifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ContractSignatoryAuthority_contractId_userId_key` (`contractId`, `userId`),
  INDEX `ContractSignatoryAuthority_userId_status_idx` (`userId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractSignatoryAuthority_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractReviewAction` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `reviewerId` VARCHAR(191) NOT NULL,
  `reviewerRole` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `note` TEXT NULL,
  `fromStatus` VARCHAR(191) NOT NULL,
  `toStatus` VARCHAR(191) NOT NULL,
  `scopeRegion` VARCHAR(191) NULL,
  `scopeWoreda` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ContractReviewAction_reviewerId_createdAt_idx` (`reviewerId`, `createdAt`),
  INDEX `ContractReviewAction_action_createdAt_idx` (`action`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ContractReviewAction_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
