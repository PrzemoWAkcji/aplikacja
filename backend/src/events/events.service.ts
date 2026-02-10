import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
    constructor(private prisma: PrismaService) { }

    create(createEventDto: CreateEventDto) {
        return this.prisma.event.create({
            data: createEventDto,
        });
    }

    findAll() {
        return this.prisma.event.findMany();
    }

    findByMeeting(meetingId: string) {
        return this.prisma.event.findMany({
            where: { meetingId },
        });
    }

    findOne(id: string) {
        return this.prisma.event.findUnique({
            where: { id },
        });
    }

    update(id: string, updateEventDto: UpdateEventDto) {
        return this.prisma.event.update({
            where: { id },
            data: updateEventDto,
        });
    }

    async generateStartList(id: string, lanesPerHeat: number = 8) {
        const entries = await this.prisma.entry.findMany({
            where: { eventId: id, status: 'CONFIRMED' },
        });

        // Simple random seeding for MVP
        // Shuffle entries
        const shuffled = entries.sort(() => 0.5 - Math.random());
        const totalEntries = shuffled.length;
        const heatCount = Math.ceil(totalEntries / lanesPerHeat);

        const updatePromises = [];

        let currentHeat = 1;
        let currentLane = 1;

        for (const entry of shuffled) {
            updatePromises.push(
                this.prisma.entry.update({
                    where: { id: entry.id },
                    data: {
                        heat: currentHeat,
                        lane: currentLane,
                    },
                }),
            );

            currentLane++;
            if (currentLane > lanesPerHeat) {
                currentHeat++;
                currentLane = 1;
            }
        }

        await this.prisma.$transaction(updatePromises);

        return { message: 'Start list generated', heats: heatCount, entries: totalEntries };
    }

    remove(id: string) {
        return this.prisma.event.delete({
            where: { id },
        });
    }
}
