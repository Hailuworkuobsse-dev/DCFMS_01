import {
  BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { SignatureService } from './signature.service';
import { CreateContractDto, ApproveContractDto, SignContractDto, SaveContractDraftDto, ContractCommentDto, ContractAnnexDto, AcceptContractChangeDto, ContractTemplateDto } from './dto/create-contract.dto';
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
  @Roles(Role.CONTRACTOR)
  async create(@Body() dto: CreateContractDto, @CurrentUser() user: JwtUser) {
    const contract = await this.contracts.create(dto, user);
    return { contract };
  }

  @Get()
  list(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: ContractStatus,
    @Query('commodity') commodity?: string,
    @Query('region') region?: string,
    @Query('woreda') woreda?: string,
  ) {
    return this.contracts.list(user, { status, commodity, region, woreda }).then((contracts) => ({ contracts }));
  }

  @Get('review-queue')
  @Roles(Role.MOA_OFFICER, Role.RBOA_OFFICER, Role.WBOA_OFFICER, Role.MOTRI_OFFICER, Role.ECC_OFFICER, Role.EAA_OFFICER)
  reviewQueue(@CurrentUser() user: JwtUser) {
    return this.contracts.listReviewQueue(user).then((contracts) => ({ contracts }));
  }

  @Get('templates')
  listTemplates(@CurrentUser() user: JwtUser, @Query('commodity') commodity?: string) {
    return this.contracts.listApprovedTemplates(user, commodity).then((templates) => ({ templates }));
  }

  @Post('templates')
  @Roles(Role.SYSTEM_ADMIN)
  createTemplate(@Body() dto: ContractTemplateDto, @CurrentUser() user: JwtUser) {
    return this.contracts.createTemplate(dto, user);
  }

  @Patch('templates/:id/approve')
  @Roles(Role.SYSTEM_ADMIN)
  approveTemplate(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.approveTemplate(id, user);
  }

  @Get('party-lookup')
  @Roles(Role.CONTRACTOR)
  lookupParties(@Query('q') query: string, @CurrentUser() user: JwtUser) {
    return this.contracts.lookupContractParties(query || '', user).then((parties) => ({ parties }));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.findOne(id, user);
  }

  @Patch(':id/draft')
  @Roles(Role.CONTRACTOR)
  saveDraft(@Param('id') id: string, @Body() dto: SaveContractDraftDto, @CurrentUser() user: JwtUser) {
    return this.contracts.saveDraft(id, dto, user);
  }

  @Get(':id/comments')
  comments(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.listComments(id, user).then((comments) => ({ comments }));
  }

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body() dto: ContractCommentDto, @CurrentUser() user: JwtUser) {
    return this.contracts.addComment(id, dto, user);
  }

  @Get(':id/annexes')
  annexes(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.listAnnexes(id, user).then((annexes) => ({ annexes }));
  }

  @Post(':id/annexes')
  addAnnex(@Param('id') id: string, @Body() dto: ContractAnnexDto, @CurrentUser() user: JwtUser) {
    return this.contracts.addAnnex(id, dto, user);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.compareVersions(id, user).then((versions) => ({ versions }));
  }

  @Get(':id/change-acceptances')
  changeAcceptances(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.listChangeAcceptances(id, user).then((acceptances) => ({ acceptances }));
  }

  @Post(':id/change-acceptances')
  acceptChange(@Param('id') id: string, @Body() dto: AcceptContractChangeDto, @CurrentUser() user: JwtUser) {
    return this.contracts.acceptChange(id, dto, user);
  }

  @Get(':id/signature-evidence')
  signatureEvidence(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.signatures.listSignatureEvidence(id, user).then((evidence) => ({ evidence }));
  }

  @Get(':id/integrity')
  async integrity(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.verifyIntegrity(id, user);
  }

  @Patch(':id/send-for-signature')
  @Roles(Role.CONTRACTOR)
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
  @Roles(Role.CONTRACTOR)
  submitForApproval(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.contracts.submitForApproval(id, user);
  }

  @Patch(':id/approve')
  @Roles(Role.MOA_OFFICER, Role.RBOA_OFFICER, Role.WBOA_OFFICER, Role.MOTRI_OFFICER, Role.ECC_OFFICER, Role.EAA_OFFICER)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveContractDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contracts.approve(id, dto.decision, dto.note, user);
  }
}
