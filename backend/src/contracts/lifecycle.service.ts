import { Injectable } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';

const ALLOWED: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ['PENDING_SIGNATURES', 'CANCELLED'],
  PENDING_SIGNATURES: ['SIGNED', 'CANCELLED'],
  SIGNED: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['IN_EXECUTION', 'CANCELLED'],
  IN_EXECUTION: ['COMPLETED', 'ADJUSTED'],
  COMPLETED: ['ADJUSTED'],
  ADJUSTED: [],
  REJECTED: ['DRAFT'],
  CANCELLED: [],
};

@Injectable()
export class LifecycleService {
  canTransition(from: ContractStatus, to: ContractStatus): boolean {
    return ALLOWED[from]?.includes(to) ?? false;
  }
}
