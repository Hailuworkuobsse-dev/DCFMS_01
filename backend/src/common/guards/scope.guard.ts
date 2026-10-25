import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminLevel } from '../enums';

/**
 * Enforces administrative scope: a REGIONAL user can only touch entities
 * whose `region` matches theirs; WOREDA-level only their woreda; etc.
 * Relies on `req.params`/`req.body.region` and `req.user`.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    if (user.adminLevel === AdminLevel.FEDERAL || !user.adminLevel) return true;

    const target = req.body?.region || req.query?.region || req.params?.region;
    if (target && user.adminLevel === AdminLevel.REGIONAL && target !== user.region) {
      throw new ForbiddenException('Out of regional scope');
    }
    if (target && user.adminLevel === AdminLevel.WOREDA && target !== user.woreda) {
      throw new ForbiddenException('Out of woreda scope');
    }
    return true;
  }
}
