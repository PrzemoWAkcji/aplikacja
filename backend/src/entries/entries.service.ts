import { Injectable } from '@nestjs/common';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EntriesService {
  constructor(private prisma: PrismaService) { }

  async create(createEntryDto: CreateEntryDto) {
    const athlete = await this.findOrCreateAthlete(createEntryDto);

    const { birthDate, yearOfBirth, ...rest } = createEntryDto;
    const bDate = birthDate ? new Date(birthDate) : undefined;
    const yob = yearOfBirth || (bDate ? bDate.getFullYear() : undefined);

    return this.prisma.entry.create({
      data: {
        ...rest,
        athleteId: athlete.id,
        dateOfBirth: bDate,
        yearOfBirth: yob,
      },
    });
  }

  async findOrCreateAthlete(data: Partial<CreateEntryDto>) {
    const { athleteName, club, sb, pb, birthDate, yearOfBirth, firstName, lastName } = data;
    if (!athleteName) throw new Error('Athlete name is required');

    // Normalize birthDate
    const bDate = birthDate ? new Date(birthDate) : undefined;

    // 1. Find Athlete
    // Search by name AND birthDate (if provided) to distinguish people
    // If no birthDate provided, fall back to name+club
    const where: any = { athleteName };
    if (bDate) {
      where.birthDate = bDate;
    } else if (club) {
      where.club = club;
    }

    let athlete = await this.prisma.athlete.findFirst({ where });

    if (!athlete) {
      athlete = await this.prisma.athlete.create({
        data: {
          athleteName,
          club,
          sb,
          pb,
          birthDate: bDate,
          yearOfBirth: yearOfBirth || (bDate ? bDate.getFullYear() : undefined),
          firstName: firstName || athleteName.split(' ')[0],
          lastName: lastName || athleteName.split(' ').slice(1).join(' ') || '',
        }
      });
    } else {
      // Optionally update SB/PB if newer? 
      if (!athlete.sb && sb) await this.prisma.athlete.update({ where: { id: athlete.id }, data: { sb } });
      if (!athlete.pb && pb) await this.prisma.athlete.update({ where: { id: athlete.id }, data: { pb } });
      if (!athlete.birthDate && bDate) await this.prisma.athlete.update({ where: { id: athlete.id }, data: { birthDate: bDate, yearOfBirth: yearOfBirth || bDate.getFullYear() } });
    }

    return athlete;
  }

  findAll() {
    return this.prisma.entry.findMany();
  }

  async searchAthletes(query: string) {
    if (!query || query.length < 2) return [];

    return this.prisma.athlete.findMany({
      where: {
        athleteName: {
          contains: query,
          mode: 'insensitive',
        }
      },
      take: 10,
      orderBy: {
        athleteName: 'asc'
      }
    });
  }

  async findAthletesByClub(club: string) {
    if (!club) return [];

    const athletes = await this.prisma.athlete.findMany({
      where: {
        club: {
          equals: club,
          mode: 'insensitive',
        }
      },
      orderBy: {
        athleteName: 'asc'
      }
    });

    // Deduplicate by name, preferring records with yearOfBirth/birthDate
    const map = new Map<string, (typeof athletes)[0]>();
    for (const a of athletes) {
      const key = a.athleteName.toLowerCase();
      const existing = map.get(key);
      if (!existing || (!existing.yearOfBirth && a.yearOfBirth)) {
        map.set(key, a);
      }
    }

    return Array.from(map.values()).slice(0, 50);
  }

  findByEvent(eventId: string) {
    return this.prisma.entry.findMany({
      where: { eventId },
    });
  }

  findOne(id: string) {
    return this.prisma.entry.findUnique({
      where: { id },
    });
  }

  update(id: string, updateEntryDto: UpdateEntryDto) {
    return this.prisma.entry.update({
      where: { id },
      data: updateEntryDto,
    });
  }

  remove(id: string) {
    return this.prisma.entry.delete({
      where: { id },
    });
  }
}
