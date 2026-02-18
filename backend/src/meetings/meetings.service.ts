import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';

@Injectable()
export class MeetingsService {
    constructor(private prisma: PrismaService) { }

    create(createMeetingDto: CreateMeetingDto, organizerId: string) {
        const { date, endDate, ...rest } = createMeetingDto;
        return this.prisma.meeting.create({
            data: {
                ...rest,
                date: new Date(date),
                endDate: endDate ? new Date(endDate) : null,
                organizerId,
            } as any,
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
                events: {
                    include: {
                        entries: {
                            select: {
                                heat: true,
                            },
                        },
                    },
                    orderBy: {
                        startTime: 'asc',
                    },
                },
            },
        });
    }

    update(id: string, updateMeetingDto: UpdateMeetingDto) {
        const { date, endDate, ...rest } = updateMeetingDto;
        const data: any = { ...rest };
        if (date) {
            data.date = new Date(date);
        }
        if (endDate) {
            data.endDate = new Date(endDate);
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

    // --- BRANDING ---

    private getUploadsPath() {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        return uploadDir;
    }

    async uploadLogo(id: string, file: Express.Multer.File) {
        if (!file) throw new Error('No file uploaded');
        const ext = path.extname(file.originalname);
        const filename = `logo-${id}-${Date.now()}${ext}`;
        const uploadDir = this.getUploadsPath();
        const filepath = path.join(uploadDir, filename);

        fs.writeFileSync(filepath, file.buffer);

        // Update DB
        return this.prisma.meeting.update({
            where: { id },
            data: { organizerLogo: filename },
        });
    }

    async uploadSponsor(id: string, file: Express.Multer.File) {
        if (!file) throw new Error('No file uploaded');
        const ext = path.extname(file.originalname);
        const filename = `sponsor-${id}-${Date.now()}-${Math.round(Math.random() * 1000)}${ext}`;
        const uploadDir = this.getUploadsPath();
        const filepath = path.join(uploadDir, filename);

        fs.writeFileSync(filepath, file.buffer);

        // Update DB - Append to array
        const meeting = await this.prisma.meeting.findUnique({ where: { id }, select: { sponsorLogos: true } });
        const currentLogos = meeting?.sponsorLogos || [];

        return this.prisma.meeting.update({
            where: { id },
            data: { sponsorLogos: [...currentLogos, filename] },
        });
    }

    async removeLogo(id: string) {
        return this.prisma.meeting.update({
            where: { id },
            data: { organizerLogo: null },
        });
        // Optionally delete file from disk, but skipping for simplicity
    }

    async clearSponsors(id: string) {
        return this.prisma.meeting.update({
            where: { id },
            data: { sponsorLogos: [] },
        });
    }

    getUploadedFile(filename: string, res: Response) {
        const filepath = path.join(this.getUploadsPath(), filename);
        if (fs.existsSync(filepath)) {
            res.sendFile(filepath);
        } else {
            res.status(404).send('File not found');
        }
    }
}
