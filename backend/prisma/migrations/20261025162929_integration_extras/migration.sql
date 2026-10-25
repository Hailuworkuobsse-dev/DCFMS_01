-- AlterTable
ALTER TABLE "Grievance" ADD COLUMN     "severity" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "deliveredKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "dealerOrgId" TEXT,
ADD COLUMN     "valueEtb" DOUBLE PRECISION;
