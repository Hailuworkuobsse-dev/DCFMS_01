import {
  IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString,
} from 'class-validator';

export class CreateContractDto {
  @IsString() commodity: string;
  @IsNumber() quantity: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() quality?: string;
  @IsString() priceMechanism: 'FIXED' | 'MARKET';
  @IsOptional() @IsNumber() fixedPrice?: number;
  @IsOptional() @IsString() deliveryStart?: string;
  @IsOptional() @IsString() deliveryEnd?: string;
  @IsObject() content: Record<string, any>;
  @IsOptional() @IsString() templateId?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() woreda?: string;
  @IsArray() parties: Array<{ role: string; farmerId?: string; userId?: string }>;
  @IsOptional() @IsArray() parcelIds?: string[];
}

export class ApproveContractDto {
  @IsString() decision: 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION';
  @IsOptional() @IsString() note?: string;
}

export class SignContractDto {
  @IsString() method: 'OTP' | 'FAYDAPASS' | 'MANUAL';
  @IsOptional() @IsString() otpCode?: string;
}


export class SaveContractDraftDto {
  @IsObject() content: Record<string, any>;
  @IsNumber() expectedVersion: number;
  @IsOptional() @IsString() changeSummary?: string;
}

export class ContractCommentDto {
  @IsString() body: string;
  @IsOptional() @IsString() clauseKey?: string;
}

export class ContractAnnexDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() content?: Record<string, any>;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsString() storageUrl?: string;
}

export class AcceptContractChangeDto {
  @IsNumber() version: number;
  @IsBoolean() accepted: boolean;
  @IsOptional() @IsString() comment?: string;
}

export class ContractTemplateDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() commodity?: string;
  @IsOptional() @IsString() language?: string;
  @IsArray() clauses: Array<{ key: string; title: string; text: string; mandatory?: boolean; editable?: boolean }>;
}
