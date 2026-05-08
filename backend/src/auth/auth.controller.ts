import {
  Controller,
  Request,
  Post,
  UseGuards,
  Get,
  Body,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Query,
  Patch,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout() {
    return;
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const requiredCode = process.env.REGISTRATION_INVITE_CODE;
    if (requiredCode) {
      if (!registerDto.inviteCode || registerDto.inviteCode !== requiredCode) {
        throw new ForbiddenException('Nieprawidłowy lub brakujący kod zaproszenia');
      }
    }
    const { inviteCode: _, ...userData } = registerDto;
    return this.authService.register(userData);
  }

  // Weryfikacja emaila: GET /auth/verify-email?token=xxx
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // Ukryty endpoint do nadawania roli ADMIN
  // POST /auth/make-admin  { "secret": "xxx", "email": "user@example.com" }
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @Post('make-admin')
  async makeAdmin(@Body() body: { secret: string; email: string }) {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || body.secret !== adminSecret) {
      throw new ForbiddenException('Nieprawidłowy secret');
    }
    const user = await this.usersService.findOne(body.email);
    if (!user) {
      throw new ForbiddenException('Użytkownik nie istnieje');
    }
    await this.usersService.setRole(user.id, Role.ADMIN);
    return { message: `Rola ADMIN nadana dla ${body.email}` };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }
}
