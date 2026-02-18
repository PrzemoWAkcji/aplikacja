import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any, info: any) {
        if (err || !user) {
            console.log('[DEBUG] JwtAuthGuard failed:', info?.message || 'No user found');
            if (info) {
                console.log('[DEBUG] Full info object:', info);
            }
            throw err || new UnauthorizedException();
        }
        return user;
    }
}
