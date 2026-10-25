import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class OtpService {
  private readonly TTL = Number(process.env.OTP_TTL_SECONDS || 300);

  constructor(private prisma: PrismaService) {}

  async issue(userId: string, purpose: string): Promise<string> {
    const code = String(randomInt(100000, 999999));
    const codeHash = this.hash(code);
    const expiresAt = new Date(Date.now() + this.TTL * 1000);

    await this.prisma.otpCode.create({
      data: { userId, codeHash, purpose, expiresAt },
    });

    // TODO(integration): send via SMS gateway (Ethio Telecom / Twilio)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP DEV] ${purpose} for ${userId}: ${code}`);
    }
    return code;
  }

  async verify(userId: string, purpose: string, code: string): Promise<boolean> {
    const record = await this.prisma.otpCode.findFirst({
      where: {
        userId, purpose,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('OTP expired or missing');
    if (record.codeHash !== this.hash(code)) throw new BadRequestException('Invalid OTP');

    await this.prisma.otpCode.update({ where: { id: record.id }, data: { consumed: true } });
    return true;
  }

  private hash(code: string) { return createHash('sha256').update(code).digest('hex'); }
}
