import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLoanDto {
  @IsString() farmerId: string;
  @IsOptional() @IsString() contractId?: string;
  @IsString() fiId: string;
  @IsNumber() requestedAmt: number;
  @IsOptional() @IsString() purpose?: string;
}

export class DecideLoanDto {
  @IsString() decision: 'APPROVE' | 'REJECT';
  @IsOptional() @IsNumber() approvedAmt?: number;
  @IsOptional() @IsNumber() interestRate?: number;
  @IsOptional() @IsString() note?: string;
}

export class IssueVoucherDto {
  @IsString() farmerId: string;
  @IsOptional() @IsString() contractId?: string;
  @IsString() inputType: string;
  @IsNumber() amount: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() valueEtb?: number;
  @IsOptional() @IsString() dealerOrgId?: string;
  @IsString() expiresAt: string;
}

export class RedeemVoucherDto {
  @IsString() voucherNo: string;
  @IsString() agroDealerId: string;
}

export class CreateSettlementDto {
  @IsString() contractId: string;
  @IsString() payerId: string;
  @IsString() payeeId: string;
  @IsNumber() grossAmount: number;
  @IsOptional() @IsNumber() loanDeduction?: number;
  @IsOptional() @IsNumber() deliveredKg?: number;
  @IsOptional() @IsString() externalRef?: string;
  @IsString() channel: 'BANK' | 'MOBILE_MONEY' | 'USSD';
}
