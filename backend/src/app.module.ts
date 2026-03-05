import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MeetingsModule } from './meetings/meetings.module';
import { EventsModule } from './events/events.module';
import { EntriesModule } from './entries/entries.module';
import { FileMappingModule } from './file-mapping/file-mapping.module';
import { ResultsModule } from './results/results.module';
import { HealthModule } from './health.module';
import { RosterModule } from './roster/roster.module';
import { PzlaModule } from './pzla/pzla.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    MeetingsModule,
    EventsModule,
    EntriesModule,
    FileMappingModule,
    ResultsModule,
    HealthModule,
    RosterModule,
    PzlaModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: import('@nestjs/common').MiddlewareConsumer) {
    consumer
      .apply((req: any, res: any, next: any) => {
        if (req.url.includes('/auth/profile')) {
          console.log(
            `[DEBUG] Incoming /auth/profile request. Auth header: ${req.headers.authorization}`,
          );
          console.log(
            `[DEBUG] Current JWT_SECRET (first 3 chars): ${process.env.JWT_SECRET?.substring(0, 3)}`,
          );
        }
        next();
      })
      .forRoutes('*');
  }
}
