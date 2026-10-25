import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminLevel, Role } from '../../common/enums';

export class CreateUserDto {
  @IsString() fullName: string;
  @IsString() phone: string;
  @IsString() @MinLength(8) password: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsEnum(AdminLevel) adminLevel?: AdminLevel;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() woreda?: string;
}
