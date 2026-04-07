import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtConstants } from './constants';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: any) {
    // Pobierz aktualną rolę z bazy — token nie może zawierać przestarzałej roli
    const user = await this.usersService.findOne(payload.email);
    if (!user) {
      throw new UnauthorizedException('Konto nie istnieje lub zostało usunięte');
    }
    return { userId: user.id, email: user.email, role: user.role };
  }
}
