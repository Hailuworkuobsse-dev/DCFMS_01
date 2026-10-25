import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminLevel } from '../enums';

/**
 * Enforces administrative scope: a REGIONAL user can only touch entities
 * whose `region` matches theirs; a WOREDA user is additionally restricted
 * to their own woreda. Region and woreda are compared field-by-field
 * (a previous version compared the payload's `region` value against the
 * user's `woreda`, wrongly blocking woreda officers — found by QA XC-11).
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    if (user.adminLevel === AdminLevel.FEDERAL || !user.adminLevel) return true;

    const pick = (field: string) =>
      req.body?.[field] || req.query?.[field] || req.params?.[field];
    const targetRegion = pick('region');
    const targetWoreda = pick('woreda');

    if (user.adminLevel === AdminLevel.REGIONAL || user.adminLevel === AdminLevel.ZONAL) {
      if (targetRegion && user.region && targetRegion !== user.region) {
        throw new ForbiddenException('Out of regional scope');
      }
    }
    if (user.adminLevel === AdminLevel.WOREDA) {
      if (targetRegion && user.region && targetRegion !== user.region) {
        throw new ForbiddenException('Out of regional scope');
      }
      if (targetWoreda && user.woreda && targetWoreda !== user.woreda) {
        throw new ForbiddenException('Out of woreda scope');
      }
    }
    return true;
  }
}
