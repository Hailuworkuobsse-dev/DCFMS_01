import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LoansService } from './loans.service';
import { VouchersService } from './vouchers.service';
import { SettlementService } from './settlement.service';
import { CreateLoanDto, DecideLoanDto, IssueVoucherDto, RedeemVoucherDto, CreateSettlementDto } from './dto';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { ScopeGuard } from '../common/guards/scope.guard';
import { LoanStatus, PaymentStatus, VoucherStatus } from '@prisma/client';

@Controller('finance')
@UseGuards(ScopeGuard)
export class FinanceController {
  constructor(
    private loans: LoansService,
    private vouchers: VouchersService,
    private settlement: SettlementService,
  ) {}

  // ---- LOANS ----
  @Post('loans')
  @Roles(Role.CONTRACTOR, Role.FI_OFFICER, Role.COOPERATIVE)
  createLoan(@Body() dto: CreateLoanDto, @CurrentUser() user: JwtUser) {
    return this.loans.create(dto, user);
  }

  @Get('loans')
  listLoans(
    @Query('status') status?: LoanStatus,
    @Query('fiId') fiId?: string,
    @Query('farmerId') farmerId?: string,
  ) {
    return this.loans.list({ status, fiId, farmerId });
  }

  @Patch('loans/:id/decide')
  @Roles(Role.FI_OFFICER)
  decideLoan(@Param('id') id: string, @Body() dto: DecideLoanDto, @CurrentUser() user: JwtUser) {
    return this.loans.decide(id, dto, user);
  }

  // ---- VOUCHERS ----
  @Post('vouchers')
  @Roles(Role.FI_OFFICER, Role.CONTRACTOR, Role.MOA_OFFICER)
  issueVoucher(@Body() dto: IssueVoucherDto, @CurrentUser() user: JwtUser) {
    return this.vouchers.issue(dto, user);
  }

  @Post('vouchers/redeem')
  @Roles(Role.AGRO_DEALER)
  redeemVoucher(@Body() dto: RedeemVoucherDto, @CurrentUser() user: JwtUser) {
    return this.vouchers.redeem(dto, user);
  }

  @Get('vouchers')
  listVouchers(@Query('farmerId') farmerId?: string, @Query('status') status?: VoucherStatus) {
    return this.vouchers.list({ farmerId, status });
  }

  // ---- SETTLEMENT ----
  @Post('settlements')
  @Roles(Role.CONTRACTOR, Role.FI_OFFICER)
  createSettlement(@Body() dto: CreateSettlementDto, @CurrentUser() user: JwtUser) {
    return this.settlement.create(dto, user);
  }

  @Get('settlements')
  listSettlements(@Query('contractId') contractId?: string, @Query('status') status?: PaymentStatus) {
    return this.settlement.list({ contractId, status });
  }
}
