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

    remove(id: string) {
        return this.prisma.meeting.delete({
            where: { id },
        });
    }
}
