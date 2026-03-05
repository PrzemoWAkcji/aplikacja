import { Injectable } from '@nestjs/common';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EntriesService {
  constructor(private prisma: PrismaService) {}

  private normalizeRelaySquad(value?: string | null) {
    const raw = (value || '').trim();
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return JSON.stringify(parsed);
      }
      return null;
    } catch {
      return null;
    }
  }

  async create(createEntryDto: CreateEntryDto) {
    const athlete = await this.findOrCreateAthlete(createEntryDto);

    const { birthDate, yearOfBirth, relaySquad, ...rest } = createEntryDto;
    const bDate = birthDate ? new Date(birthDate) : undefined;
    const yob = yearOfBirth || (bDate ? bDate.getFullYear() : undefined);
    const normalizedRelaySquad = this.normalizeRelaySquad(relaySquad);

    return this.prisma.entry.create({
      data: {
        ...rest,
        athleteId: athlete.id,
        dateOfBirth: bDate,
        yearOfBirth: yob,
        relaySquad: normalizedRelaySquad,
      },
    });
  }

  async findOrCreateAthlete(data: Partial<CreateEntryDto>) {
    const {
      athleteName,
      club,
      sb,
      pb,
      birthDate,
      yearOfBirth,
      firstName,
      lastName,
    } = data;
    if (!athleteName) throw new Error('Athlete name is required');

    // Normalize inputs
    const bDate = birthDate ? new Date(birthDate) : undefined;
    const yob = yearOfBirth || (bDate ? bDate.getFullYear() : undefined);

    const fName = firstName || athleteName.split(' ')[0];
    const lName = lastName || athleteName.split(' ').slice(1).join(' ') || '';

    // 1. Search by Name Parts (Broader search)
    // We search by firstName + lastName to catch partial matches
    let candidates = await this.prisma.athlete.findMany({
      where: {
        firstName: { equals: fName, mode: 'insensitive' },
        lastName: { equals: lName, mode: 'insensitive' },
      },
    });

    // Fallback: search by full athleteName if parts didn't return anything (e.g. data migration legacy)
    if (candidates.length === 0) {
      candidates = await this.prisma.athlete.findMany({
        where: {
          athleteName: { equals: athleteName, mode: 'insensitive' },
        },
      });
    }

    // 2. Fuzzy Match Logic
    let match = candidates.find((c) => {
      // A. If both have Year of Birth -> Must match
      if (c.yearOfBirth && yob) {
        return c.yearOfBirth === yob;
      }

      // B. If one has Year and other doesn't -> Check Club
      if ((c.yearOfBirth || yob) && !(c.yearOfBirth && yob)) {
        // If club is provided for both, it should match
        if (c.club && club) {
          // Loose club matching?
          return c.club.toLowerCase() === club.toLowerCase();
        }
        // If one is missing club, we assume it's the same person (optimistic matching for "upgrading" a record)
        return true;
      }

      // C. If neither has Year -> Check Club
      if (c.club && club) {
        return c.club.toLowerCase() === club.toLowerCase();
      }

      // D. Last resort: If names match and no conflicting info exists -> Match
      return true;
    });

    if (!match) {
      match = await this.prisma.athlete.create({
        data: {
          athleteName,
          firstName: fName,
          lastName: lName,
          club,
          sb,
          pb,
          birthDate: bDate,
          yearOfBirth: yob,
        },
      });
    } else {
      // 3. Update existing record with new/better info
      const updateData: any = {};
      if (!match.birthDate && bDate) {
        updateData.birthDate = bDate;
        updateData.yearOfBirth = yob;
      } else if (!match.yearOfBirth && yob) {
        updateData.yearOfBirth = yob;
      }

      if (!match.club && club) updateData.club = club;
      if (!match.firstName && fName) updateData.firstName = fName;
      if (!match.lastName && lName) updateData.lastName = lName;
      // Always update SB/PB if provided (assuming new import is fresher)
      if (sb) updateData.sb = sb;
      if (pb) updateData.pb = pb;

      if (Object.keys(updateData).length > 0) {
        match = await this.prisma.athlete.update({
          where: { id: match.id },
          data: updateData,
        });
      }
    }

    return match;
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
        },
      },
      take: 10,
      orderBy: {
        athleteName: 'asc',
      },
    });
  }

  async findAthletesByClub(club: string) {
    if (!club) return [];

    const athletes = await this.prisma.athlete.findMany({
      where: {
        club: {
          equals: club,
          mode: 'insensitive',
        },
      },
      orderBy: {
        athleteName: 'asc',
      },
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
    const data: any = { ...updateEntryDto };

    if (Object.prototype.hasOwnProperty.call(updateEntryDto, 'relaySquad')) {
      data.relaySquad = this.normalizeRelaySquad(updateEntryDto.relaySquad);
    }

    return this.prisma.entry.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.entry.delete({
      where: { id },
    });
  }
}
