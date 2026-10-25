import { IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString() purpose: string;
}

export class VerifyOtpDto {
  @IsString() purpose: string;
  @IsString() @Length(6, 6) code: string;
}
