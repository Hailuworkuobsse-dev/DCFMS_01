import {
  BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { SignatureService } from './signature.service';
import { CreateContractDto, ApproveContractDto, SignContractDto } from './dto/create-contract.dto';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { ScopeGuard } from '../common/guards/scope.guard';
import { ContractStatus } from '@prisma/client';

@Controller('contracts')
@UseGuards(ScopeGuard)
export class ContractsController {
  constructor(
    private contracts: ContractsService,
    private signatures: SignatureService,
  ) {}

  @Post()
  @Roles(Role.CONTRACTOR, Role.COOPERATIVE, Role.MOA_OFFICER, Role.WBOA_OFFICER)
  create(@Body() dto: CreateContractDto, @CurrentUser() user: JwtUser) {
    return this.contracts.create(dto, user);
  }

  @Get()
  list(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: ContractStatus,
    @Query('commodity') commodity?: string,
  ) {
    return this.contracts.list(user, { status, commodity });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.findOne(id, user);
  }

  @Get(':id/integrity')
  integrity(@Param('id') id: string) {
    return this.contracts.verifyIntegrity(id);
  }

  @Patch(':id/send-for-signature')
  @Roles(Role.CONTRACTOR, Role.MOA_OFFICER, Role.WBOA_OFFICER)
  sendForSignature(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.sendForSignatures(id, user);
  }

  @Post(':id/sign/request-otp')
  requestSigningOtp(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.signatures.requestSigningOtp(id, user.sub);
  }

  @Post(':id/sign')
  sign(
    @Param('id') id: string,
    @Body() dto: SignContractDto,
    @CurrentUser() user: JwtUser,
    @Req() req: any,
  ) {
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    if (dto.method === 'FAYDAPASS') {
      return this.signatures.signWithFaydaPass(id, dto.otpCode ?? '');
    }
    if (dto.method !== 'OTP') {
      throw new BadRequestException('Only OTP and FAYDAPASS signing methods are currently supported');
    }
    if (!dto.otpCode) {
      throw new BadRequestException('otpCode is required for OTP signing');
    }
    return this.signatures.signWithOtp(id, user.sub, dto.otpCode, meta);
  }

  @Patch(':id/submit-approval')
  @Roles(Role.CONTRACTOR, Role.COOPERATIVE)
  submitForApproval(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.submitForApproval(id, user);
  }

  @Patch(':id/approve')
  @Roles(Role.MOA_OFFICER, Role.RBOA_OFFICER, Role.WBOA_OFFICER)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveContractDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contracts.approve(id, dto.decision, dto.note, user);
  }
}
