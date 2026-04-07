import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { refreshConstants } from './refresh-constants';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const sanitizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findOne(sanitizedEmail);

    if (user) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(user: any) {
    return {
      access_token: this.generateAccessToken(user),
      refresh_token: this.generateRefreshToken(user.id),
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: refreshConstants.secret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Nieprawidłowy typ tokena');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Użytkownik nie istnieje');
      }

      // Rotacja: nowy access + refresh token przy każdym odświeżeniu
      return {
        access_token: this.generateAccessToken(user),
        refresh_token: this.generateRefreshToken(user.id),
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Refresh token wygasł lub jest nieprawidłowy');
    }
  }

  async register(user: any) {
    return this.usersService.create(user);
  }

  private generateAccessToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.sign({
      email: user.email,
      sub: user.id,
      role: user.role,
    });
  }

  private generateRefreshToken(userId: string) {
    return this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      { secret: refreshConstants.secret, expiresIn: '7d' },
    );
  }
}
