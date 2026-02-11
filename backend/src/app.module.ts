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
export class AppModule { }
