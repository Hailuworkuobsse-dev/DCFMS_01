import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { AdminLevel, Role } from '../../common/enums';

export class RegisterDto {
  @IsString() fullName: string;
  @IsPhoneNumber() phone: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MinLength(8) password: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsEnum(AdminLevel) adminLevel?: AdminLevel;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() zone?: string;
  @IsOptional() @IsString() woreda?: string;
  @IsOptional() @IsString() kebele?: string;
}
