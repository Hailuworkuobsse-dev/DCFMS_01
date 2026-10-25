import { IsEnum, IsOptional, IsString } from 'class-validator';
import { GrievanceCategory } from '@prisma/client';

export class CreateGrievanceDto {
  @IsEnum(GrievanceCategory) category: GrievanceCategory;
  @IsString() description: string;
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() raisedByFarmerId?: string;
}

export class AssignGrievanceDto {
  @IsString() assignedToId: string;
  @IsString() slaDueAt: string;
}

export class ResolveGrievanceDto {
  @IsString() resolutionNote: string;
}

export class EscalateGrievanceDto {
  @IsString() reason: string;
}
