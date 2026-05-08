import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'ATHLETE' | 'COACH' | 'ORGANIZER';
  dateOfBirth?: string;
  clubName?: string;
  licenseNumber?: string;
  phoneNumber?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmailToken(token: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { emailToken: token } });
  }

  async create(data: CreateUserInput): Promise<{ user: User; emailToken: string | null }> {
    const existing = await this.findOne(data.email.trim().toLowerCase());
    if (existing) {
      throw new ConflictException('Konto z tym adresem email już istnieje');
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
    const emailToken = requireVerification ? randomUUID() : null;

    // Map role string to Prisma Role enum; default ATHLETE
    const roleMap: Record<string, Role> = {
      ATHLETE: Role.ATHLETE,
      COACH: Role.COACH,
      ORGANIZER: Role.ORGANIZER,
    };
    const role: Role = roleMap[data.role ?? ''] ?? Role.ATHLETE;

    const clubName = data.clubName?.trim() || 'niestowarzyszony';

    const user = await this.prisma.user.create({
      data: {
        email: data.email.trim().toLowerCase(),
        password: hashedPassword,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role,
        emailVerified: !requireVerification,
        emailToken,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        clubName: ['ATHLETE', 'COACH'].includes(data.role ?? '') ? clubName : null,
        licenseNumber: data.licenseNumber?.trim() || null,
        phoneNumber: data.phoneNumber?.trim() || null,
      },
    });

    return { user, emailToken };
  }

  async verifyEmail(token: string): Promise<User> {
    const user = await this.findByEmailToken(token);
    if (!user) {
      throw new BadRequestException('Nieprawidłowy lub wygasły link aktywacyjny');
    }
    return this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailToken: null },
    });
  }

  async setRole(userId: string, role: Role): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }
}
