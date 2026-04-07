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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
    // Refresh token jest stateless (JWT) — wylogowanie po stronie klienta
    // W przyszłości: dodać blacklistę w Redis dla natychmiastowej inwalidacji
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

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }
}
