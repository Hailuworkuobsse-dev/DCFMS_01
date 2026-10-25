import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { MonitoringType } from '@prisma/client';

export class CreateMonitoringDto {
  @IsOptional() @IsString() contractId?: string;
  @IsEnum(MonitoringType) type: MonitoringType;
  @IsOptional() @IsString() farmerId?: string;
  @IsOptional() @IsNumber() gpsLat?: number;
  @IsOptional() @IsNumber() gpsLng?: number;
  @IsObject() findings: Record<string, any>;
  @IsOptional() @IsNumber() score?: number;
}
