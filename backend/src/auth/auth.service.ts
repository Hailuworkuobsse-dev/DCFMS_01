import {
  Injectable, UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ phone: dto.phone }, { email: dto.email || undefined }] },
    });
    if (exists) throw new ConflictException('Phone or email already registered');

    const passwordHash = await bcrypt.hash(
      dto.password, Number(process.env.BCRYPT_ROUNDS || 12),
    );

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        passwordHash,
        // Local TS enums mirror the Prisma enums value-for-value
        role: dto.role as any,
        adminLevel: dto.adminLevel as any,
        region: dto.region,
        zone: dto.zone,
        woreda: dto.woreda,
        kebele: dto.kebele,
      },
    });
    return { id: user.id, phone: user.phone, role: user.role };
  }

  async login(dto: LoginDto, ip?: string, ua?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: dto.identifier },
          { email: dto.identifier },
        ],
        isActive: true,
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.audit.log({
        actorId: user.id, action: AuditAction.LOGIN,
        entity: 'Auth', result: 'FAILED', ipAddress: ip, userAgent: ua,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id }, data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user);

    await this.audit.log({
      actorId: user.id, action: AuditAction.LOGIN,
      entity: 'Auth', result: 'SUCCESS', ipAddress: ip, userAgent: ua,
    });

    return {
      ...tokens,
      user: {
        id: user.id, fullName: user.fullName, role: user.role,
        email: user.email, phone: user.phone,
        adminLevel: user.adminLevel, region: user.region,
        zone: user.zone, woreda: user.woreda, kebele: user.kebele,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id }, data: { revokedAt: new Date() },
    });
    return this.issueTokens(record.user);
  }

  private async issueTokens(user: any) {
    const payload = {
      sub: user.id, role: user.role,
      adminLevel: user.adminLevel, region: user.region, woreda: user.woreda,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET || 'dev-secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
    const refreshToken = await this.jwt.signAsync(
      // `jti` guarantees uniqueness: without it, two logins within the same
      // second produce identical tokens (iat has 1s precision) and violate
      // the RefreshToken.tokenHash unique constraint.
      { sub: user.id, t: 'refresh', jti: randomUUID() },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
    );
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
    return { accessToken, refreshToken };
  }
}
