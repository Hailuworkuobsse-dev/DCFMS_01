import {
  IsArray, IsNumber, IsObject, IsOptional, IsString,
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
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() woreda?: string;
  @IsArray() parties: Array<{ role: string; farmerId?: string; userId?: string }>;
  @IsOptional() @IsArray() parcelIds?: string[];
}

export class ApproveContractDto {
  @IsString() decision: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() note?: string;
}

export class SignContractDto {
  @IsString() method: 'OTP' | 'FAYDAPASS' | 'MANUAL';
  @IsOptional() @IsString() otpCode?: string;
}
