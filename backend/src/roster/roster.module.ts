import { Module } from '@nestjs/common';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EntriesModule } from '../entries/entries.module';

@Module({
    imports: [PrismaModule, EntriesModule],
    controllers: [RosterController],
    providers: [RosterService],
    exports: [RosterService],
})
export class RosterModule { }
