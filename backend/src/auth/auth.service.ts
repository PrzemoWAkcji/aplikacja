import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const sanitizedEmail = email.trim().toLowerCase();
    console.log(`AuthService validateUser (sanitized): ${sanitizedEmail}`);

    const user = await this.usersService.findOne(sanitizedEmail);

    if (user) {
      const isMatch = await bcrypt.compare(pass, user.password);
      console.log(`AuthService: User found. Pwd match: ${isMatch}`);
      if (isMatch) {
        const { password, ...result } = user;
        return result;
      }
    } else {
      console.log('AuthService: User not found for email:', sanitizedEmail);
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(user: any) {
    return this.usersService.create(user);
  }
}
