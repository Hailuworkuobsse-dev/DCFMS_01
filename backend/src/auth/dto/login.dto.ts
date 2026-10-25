import { IsString } from 'class-validator';

export class LoginDto {
  @IsString() identifier: string; // phone or email
  @IsString() password: string;
}
