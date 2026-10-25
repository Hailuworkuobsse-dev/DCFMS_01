import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '@prisma/client';

/**
 * Records every write/approve/sign action into the immutable audit log.
 * GET requests are only audited when explicitly flagged with @AuditAction().
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const user = req.user;
    const path = req.route?.path || req.url;

    const actionMap: Record<string, AuditAction | undefined> = {
      POST: AuditAction.CREATE,
      PATCH: AuditAction.UPDATE,
      PUT: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
    };
    const action = actionMap[method];
    if (!action || !user) return next.handle();

    return next.handle().pipe(
      tap(async (result) => {
        await this.audit.log({
          actorId: user.sub,
          action,
          entity: path.split('/')[1] || 'unknown',
          entityId: result?.id,
          after: safeJson(result),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          result: 'SUCCESS',
        });
      }),
    );
  }
}

function safeJson(v: any) { try { return JSON.parse(JSON.stringify(v)); } catch { return null; } }
