import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { refreshConstants } from './refresh-constants';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private mailService: MailService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const sanitizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findOne(sanitizedEmail);
    if (!user) return null;

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) return null;

    // Blokada logowania gdy email nie zweryfikowany
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Proszę zweryfikować adres email przed zalogowaniem. Sprawdź skrzynkę pocztową.',
      );
    }

    const { password, ...result } = user;
    return result;
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
      if (!user) throw new UnauthorizedException('Użytkownik nie istnieje');
      return {
        access_token: this.generateAccessToken(user),
        refresh_token: this.generateRefreshToken(user.id),
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Refresh token wygasł lub jest nieprawidłowy');
    }
  }

  async register(dto: Omit<RegisterDto, 'inviteCode'>) {
    const { user, emailToken } = await this.usersService.create(dto);

    if (emailToken) {
      // Wyślij email weryfikacyjny
      await this.mailService.sendVerificationEmail(
        user.email,
        user.firstName,
        emailToken,
      );
      return {
        message:
          'Konto założone! Sprawdź skrzynkę email i kliknij link aktywacyjny.',
        emailVerificationRequired: true,
      };
    }

    // Brak weryfikacji email — wyślij email powitalny
    await this.mailService.sendWelcomeEmail(user.email, user.firstName);
    return {
      message: 'Konto założone pomyślnie! Możesz się teraz zalogować.',
      emailVerificationRequired: false,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.verifyEmail(token);
    await this.mailService.sendWelcomeEmail(user.email, user.firstName);
    return { message: 'Email zweryfikowany. Możesz się teraz zalogować.' };
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
