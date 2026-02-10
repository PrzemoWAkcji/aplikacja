import { Injectable } from '@nestjs/common';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EntriesService {
  constructor(private prisma: PrismaService) { }

  create(createEntryDto: CreateEntryDto) {
    return this.prisma.entry.create({
      data: createEntryDto,
    });
  }

  findAll() {
    return this.prisma.entry.findMany();
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
