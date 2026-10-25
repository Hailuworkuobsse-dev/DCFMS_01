import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { SignatureService } from './signature.service';
import { LifecycleService } from './lifecycle.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ContractsController],
  providers: [ContractsService, SignatureService, LifecycleService],
  exports: [ContractsService],
})
export class ContractsModule {}
