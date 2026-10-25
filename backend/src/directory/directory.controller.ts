import { Controller, Get } from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('directory')
export class DirectoryController {
  constructor(private directory: DirectoryService) {}

  @Get('farmers')
  farmers(@CurrentUser() user: JwtUser) {
    return this.directory.farmers(user);
  }

  @Get('orgs')
  orgs() {
    return this.directory.orgs();
  }
}
