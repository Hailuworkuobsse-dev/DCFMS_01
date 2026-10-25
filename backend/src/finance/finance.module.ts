import { Module } from '@nestjs/common';
import { LoansService } from './loans.service';
import { VouchersService } from './vouchers.service';
import { SettlementService } from './settlement.service';
import { FinanceController } from './finance.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [FinanceController],
  providers: [LoansService, VouchersService, SettlementService],
  exports: [LoansService, VouchersService, SettlementService],
})
export class FinanceModule {}
