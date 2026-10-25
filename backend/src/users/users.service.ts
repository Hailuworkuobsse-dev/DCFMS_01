import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../common/enums';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(filter: { role?: Role; region?: string; woreda?: string }) {
    return this.prisma.user.findMany({
      where: {
        // TS enum values are identical to the Prisma enum values
        role: filter.role as any,
        region: filter.region,
        woreda: filter.woreda,
        isActive: true,
      },
      select: {
        id: true, fullName: true, phone: true, email: true,
        role: true, adminLevel: true, region: true, woreda: true,
        isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, fullName: true, phone: true, email: true,
        role: true, adminLevel: true, region: true, woreda: true,
        isActive: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(
      dto.password, Number(process.env.BCRYPT_ROUNDS || 12),
    );
    return this.prisma.user.create({
      data: {
        fullName: dto.fullName, phone: dto.phone,
        passwordHash,
        role: dto.role as any,
        adminLevel: dto.adminLevel as any,
        region: dto.region, woreda: dto.woreda,
      },
      select: { id: true, phone: true, role: true },
    });
  }

  async deactivate(id: string) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id }, data: { isActive: false },
      select: { id: true, isActive: true },
    });
  }
}
