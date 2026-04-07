import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { RecordsModule } from './records/records.module';
import { BroadcastModule } from './broadcast/broadcast.module';

@Module({
  imports: [
    // Rate limiting: globalny limit 100 req/min; auth endpoints mają własny, ostrzejszy limit
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
    ]),
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
    RecordsModule,
    BroadcastModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Globalny guard throttlera — nadpisz @Throttle() na konkretnych endpointach
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
