import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

@Injectable()
export class MeetingsService {
    constructor(private prisma: PrismaService) { }

    create(createMeetingDto: CreateMeetingDto, organizerId: string) {
        return this.prisma.meeting.create({
            data: {
                ...createMeetingDto,
                date: new Date(createMeetingDto.date),
                organizerId,
            },
        });
    }

    findAll() {
        return this.prisma.meeting.findMany({
            include: {
                events: true,
            },
        });
    }

    findOne(id: string) {
        return this.prisma.meeting.findUnique({
            where: { id },
            include: {
                events: true,
            },
        });
    }

    update(id: string, updateMeetingDto: UpdateMeetingDto) {
        const { date, ...rest } = updateMeetingDto;
        const data: any = { ...rest };
        if (date) {
            data.date = new Date(date);
        }
        return this.prisma.meeting.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        return this.prisma.meeting.delete({
            where: { id },
        });
    }

    async deleteAllEvents(meetingId: string) {
        const events = await this.prisma.event.findMany({
            where: { meetingId },
            select: { id: true },
        });
        const eventIds = events.map((e) => e.id);

        if (eventIds.length > 0) {
            // Find entries associated with these events to clean up results
            const entries = await this.prisma.entry.findMany({
                where: { eventId: { in: eventIds } },
                select: { id: true },
            });
            const entryIds = entries.map((e) => e.id);

            if (entryIds.length > 0) {
                // Delete results associated with entries first
                await this.prisma.result.deleteMany({
                    where: { entryId: { in: entryIds } },
                });

                // Then delete entries
                await this.prisma.entry.deleteMany({
                    where: { id: { in: entryIds } },
                });
            }

            // Finally delete events
            await this.prisma.event.deleteMany({
                where: { meetingId },
            });
        }
        return { count: eventIds.length };
    }

    async getPrintData(id: string) {
        return this.prisma.meeting.findUnique({
            where: { id },
            include: {
                events: {
                    include: {
                        entries: {
                            where: { status: 'CONFIRMED' },
                            orderBy: [
                                { heat: 'asc' },
                                { lane: 'asc' },
                            ],
                        },
                    },
                    orderBy: {
                        // Assuming we want some logical order, e.g., by name or creation?
                        // Schema doesn't have 'order' field yet, utilizing code or name.
                        code: 'asc',
                    },
                },
            },
        });
    }
}
