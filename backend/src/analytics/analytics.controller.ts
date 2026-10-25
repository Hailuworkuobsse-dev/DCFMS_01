import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtUser) { return this.analytics.dashboard(user); }

  @Get('contract-performance')
  performance(@CurrentUser() user: JwtUser) { return this.analytics.contractPerformance(user); }
}
