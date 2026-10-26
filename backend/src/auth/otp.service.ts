import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class OtpService {
  private readonly TTL = Number(process.env.OTP_TTL_SECONDS || 300);
  private readonly MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  private readonly RESEND_COOLDOWN = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30);

  constructor(private prisma: PrismaService) {}

  async issue(userId: string, purpose: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, isActive: true },
    });
    if (!user?.isActive || !user.phone) throw new BadRequestException('An active account with a verified phone number is required');

    const recent = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, createdAt: { gt: new Date(Date.now() - this.RESEND_COOLDOWN * 1000) } },
      select: { id: true },
    });
    if (recent) throw new BadRequestException('Please wait before requesting another OTP');

    const code = String(randomInt(100000, 1000000));
    const codeHash = this.hash(code);
    const expiresAt = new Date(Date.now() + this.TTL * 1000);
    await this.deliverSms(user.phone, `Your DCFMS signing verification code is ${code}. It expires in ${Math.ceil(this.TTL / 60)} minutes. Do not share this code.`);

    await this.prisma.otpCode.create({
      data: { userId, codeHash, purpose, expiresAt },
    });
    return code;
  }

  async verify(userId: string, purpose: string, code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code || '')) throw new BadRequestException('Enter the six-digit OTP');
    const record = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('OTP expired or missing');
    if (record.codeHash !== this.hash(code)) {
      const attempts = record.attempts + 1;
      const update = await this.prisma.otpCode.updateMany({
        where: { id: record.id, consumed: false, attempts: record.attempts },
        data: { attempts: { increment: 1 }, consumed: attempts >= this.MAX_ATTEMPTS },
      });
      if (update.count !== 1) throw new BadRequestException('OTP has already been used or invalidated');
      throw new BadRequestException(attempts >= this.MAX_ATTEMPTS ? 'Too many invalid OTP attempts. Request a new code.' : 'Invalid OTP');
    }

    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: record.id, consumed: false, expiresAt: { gt: new Date() } },
      data: { consumed: true },
    });
    if (consumed.count !== 1) throw new BadRequestException('OTP has already been used');
    return true;
  }

  private async deliverSms(phone: string, message: string) {
    const endpoint = process.env.SMS_GATEWAY_URL;
    const token = process.env.SMS_GATEWAY_TOKEN;
    const sender = process.env.SMS_GATEWAY_SENDER || 'DCFMS';
    if (!endpoint || !token) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Signing OTP delivery is not configured. Contact the system administrator.');
      }
      // Development only: keep the OTP visible in server logs for local testing.
      console.log('[OTP DEV] SMS gateway is not configured; OTP will be logged after issuance.');
      console.log(`[OTP DEV] Recipient: ${phone}; message: ${message}`);
      return;
    }
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: phone, sender, message }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ServiceUnavailableException('SMS gateway is unreachable; no OTP was issued');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(`SMS gateway rejected delivery (HTTP ${response.status}); no OTP was issued`);
    }
  }

  private hash(code: string) { return createHash('sha256').update(code).digest('hex'); }
}
