import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { GenerateStartListDto } from './dto/generate-start-list.dto';

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

    async generateStartList(id: string, params: GenerateStartListDto) {
        const { lanes = 8, method = 'RANDOM', criterion = 'SB' } = params;

        const entries = await this.prisma.entry.findMany({
            where: { eventId: id, status: 'CONFIRMED' },
        });

        if (entries.length === 0) return { message: 'No entries found', count: 0 };

        // 1. Parse Performance
        const entriesWithTime = entries.map((e) => ({
            ...e,
            perfValue: this.parsePerformance(criterion === 'PB' ? e.pb : e.sb),
        }));

        // 2. Sort entries (Best to Worst -> Lowest time to Highest time)
        // Assuming Track events (Running) where lower is better.
        // For Field events, higher is better.
        // TODO: Add event type check. For MVP assuming Runs (Time).
        const sorted = entriesWithTime.sort((a, b) => a.perfValue - b.perfValue);

        // 3. Group into Heats
        let heats: typeof sorted[] = [];
        const totalEntries = sorted.length;
        const heatCount = Math.ceil(totalEntries / lanes);

        if (method === 'RANDOM') {
            // Random shuffle
            const shuffled = [...sorted].sort(() => 0.5 - Math.random());
            for (let i = 0; i < heatCount; i++) {
                heats.push(shuffled.slice(i * lanes, (i + 1) * lanes));
            }
        } else if (method === 'SNAKE' || method === 'ZIGZAG') {
            // Initialize empty heats
            for (let i = 0; i < heatCount; i++) heats.push([]);

            // Distribute (ZigZag for balanced heats)
            // Snake adds reversal in direction? No, typically ZigZag is 1->H1, 2->H2...
            // "Roster" Snake seeding usually refers to ZigZag distribution to balance heats.
            // Let's implement standard ZigZag distribution.
            // 0, 1, 2 ... N-1, N-1 ... 2, 1, 0 (Snake distribution actually)

            let currentHeat = 0;
            let direction = 1;

            if (method === 'ZIGZAG') {
                // Simple ZigZag: 0, 1, 2... N-1, 0, 1, 2...
                // This creates unbalanced heats (Heat 1 is always strongest).
                // "Serpentine" (Snake) is better.
                for (let i = 0; i < totalEntries; i++) {
                    heats[i % heatCount].push(sorted[i]);
                }
            } else {
                // SNAKE (Serpentine)
                for (const entry of sorted) {
                    heats[currentHeat].push(entry);
                    if (direction === 1) {
                        if (currentHeat === heatCount - 1) {
                            direction = -1;
                        } else {
                            currentHeat++;
                        }
                    } else {
                        if (currentHeat === 0) {
                            direction = 1;
                        } else {
                            currentHeat--;
                        }
                    }
                }
            }
        } else {
            // BEST_FROM_LAST (Standard Series Seeding)
            // Slowest -> Heat 1, Fastest -> Heat N.
            // Sorted is Best->Worst.
            // Reverse sorted: Worst->Best.
            const reversed = [...sorted].reverse();
            for (let i = 0; i < heatCount; i++) {
                // Take chunk
                const chunk = reversed.slice(i * lanes, (i + 1) * lanes);
                heats.push(chunk);
            }
        }

        // 4. Assign Lanes and Persist
        // Lane order (Middle-Out preferences)
        const laneOrder = this.getLaneOrder(lanes);

        const updatePromises = [];
        let heatNumber = 1;

        for (const heatEntries of heats) {
            // Sort heat entries by performance (Best -> Worst) within the heat
            // to assign best lanes to best athletes.
            // If method was RANDOM, local sort doesn't make sense? 
            // Yes, usually even in random heats, you put best PB on best lane if available.
            // But if completely random, just assign as is.
            // Let's sort by perf for lane assignment always, unless Random.
            if (method !== 'RANDOM') {
                heatEntries.sort((a, b) => a.perfValue - b.perfValue);
            }

            // Assign lanes
            for (let i = 0; i < heatEntries.length; i++) {
                const entry = heatEntries[i];
                // Get preferred lane based on rank (i)
                // If specific rules/lanes provided, use them.
                // Default Middle-Out.
                // If more entries than lanes (shouldn't happen in heats logic above), overflow.

                // Map rank (i) to lane from order array
                // i=0 (Best) -> laneOrder[0] (Center)
                let lane = laneOrder[i] || (i + 1); // Fallback to linear if out of preferences

                // If lane > lanes limit (e.g. 9th person on 8 lane track? shouldn't happen with heat split)
                // Just keep it.

                updatePromises.push(
                    this.prisma.entry.update({
                        where: { id: entry.id },
                        data: {
                            heat: heatNumber,
                            lane: lane,
                        },
                    }),
                );
            }
            heatNumber++;
        }

        await this.prisma.$transaction(updatePromises);

        return { message: 'Start list generated', heats: heatCount, entries: totalEntries };
    }

    private parsePerformance(perf: string | null): number {
        if (!perf) return Infinity;
        const p = perf.trim().toUpperCase().replace(',', '.');
        if (['', 'NM', 'DNF', 'DNS', 'DQ', 'X'].includes(p)) return Infinity;

        // Try parsing numbers
        // Format: SS.ms or MM:SS.ms
        const parts = p.split(':');
        let seconds = 0;

        if (parts.length === 2) {
            seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
        } else if (parts.length === 1) {
            seconds = parseFloat(parts[0]);
        } else {
            return Infinity;
        }

        return isNaN(seconds) ? Infinity : seconds;
    }

    private getLaneOrder(lanes: number): number[] {
        // Generate Middle-Out order: [4, 5, 3, 6, 2, 7, 1, 8] for 8 lanes
        const order: number[] = [];
        const center = Math.ceil(lanes / 2);
        order.push(center);

        // Pattern: +1, -1, +2, -2...
        // 4 -> 5 -> 3 -> 6 -> 2 -> 7 -> 1 -> 8

        for (let i = 1; i < lanes; i++) {
            if (i % 2 !== 0) { // Odd step 1, 3, 5: Add ceil(i/2)
                const l = center + Math.ceil(i / 2);
                if (l <= lanes) order.push(l);
            } else { // Even step 2, 4, 6: Subtract i/2
                const l = center - (i / 2);
                if (l > 0) order.push(l);
            }
        }

        // Fill missing or fix range?
        // Simple manual overrides for common track sizes? 
        // 8 lanes: 4, 5, 3, 6, 2, 7, 1, 8
        // 6 lanes: 3, 4, 2, 5, 1, 6

        // My algorithm above:
        // L=8. Center=4.
        // i=1 (odd): 4 + 1 = 5. Order: 4, 5.
        // i=2 (even): 4 - 1 = 3. Order: 4, 5, 3.
        // i=3 (odd): 4 + 2 = 6. Order: 4, 5, 3, 6.
        // i=4 (even): 4 - 2 = 2. Order: 4, 5, 3, 6, 2.
        // ...
        // Works perfectly!

        return order;
    }

    async clearSeeding(id: string) {
        return this.prisma.entry.updateMany({
            where: { eventId: id },
            data: { heat: null, lane: null },
        });
    }

    async remove(id: string) {
        // Delete all results associated with entries in this event first
        const entries = await this.prisma.entry.findMany({
            where: { eventId: id },
            select: { id: true },
        });
        const entryIds = entries.map((e) => e.id);

        if (entryIds.length > 0) {
            await this.prisma.result.deleteMany({
                where: { entryId: { in: entryIds } },
            });
            await this.prisma.entry.deleteMany({
                where: { id: { in: entryIds } },
            });
        }

        return this.prisma.event.delete({
            where: { id },
        });
    }
}
