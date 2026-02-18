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
        const { lanes = 8, method = 'RANDOM', criterion = 'SB', heats, laneAssignment = 'STANDARD' } = params;

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
        const sorted = entriesWithTime.sort((a, b) => a.perfValue - b.perfValue);

        // 3. Group into Heats
        const totalEntries = sorted.length;
        let heatCount = 0;

        if (heats && heats > 0) {
            heatCount = heats;
        } else {
            heatCount = Math.ceil(totalEntries / lanes);
        }

        // Calculate balanced sizes
        const baseSize = Math.floor(totalEntries / heatCount);
        const remainder = totalEntries % heatCount;
        // The first 'remainder' heats get baseSize + 1? Or the last?
        // It depends on the method.
        // We prep an array of target sizes for each heat index [0...heatCount-1]
        const heatSizes = new Array(heatCount).fill(baseSize);

        let groupedHeats: typeof sorted[] = [];
        for (let i = 0; i < heatCount; i++) groupedHeats.push([]);

        // Method-based distribution
        if (method === 'RANDOM') {
            // Distribute remainder randomly or to first heats?
            // Usually simply 0..remainder-1 get +1
            for (let i = 0; i < remainder; i++) heatSizes[i]++;

            const shuffled = [...sorted].sort(() => 0.5 - Math.random());
            let offset = 0;
            for (let i = 0; i < heatCount; i++) {
                groupedHeats[i] = shuffled.slice(offset, offset + heatSizes[i]);
                offset += heatSizes[i];
            }
        } else if (method === 'SNAKE' || method === 'ZIGZAG') {
            // These methods naturally balance, so we just run them.
            // ZIGZAG: 0, 1, 2, 0, 1, 2...
            // SNAKE: 0, 1, 2, 2, 1, 0...

            let currentHeat = 0;
            let direction = 1;

            if (method === 'ZIGZAG') {
                for (let i = 0; i < totalEntries; i++) {
                    groupedHeats[i % heatCount].push(sorted[i]);
                }
            } else {
                // SNAKE
                for (const entry of sorted) {
                    groupedHeats[currentHeat].push(entry);
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
        } else if (method === 'BEST_FROM_LAST') {
            // Goal: Fastest in LAST heat.
            // Heats should be balanced.
            // Remainder (larger heats) should go to the LAST heats (Fastest).
            // Example: 81 entries, 11 heats. Remainder 4.
            // Heats 0..6 (Slow): 7 entries.
            // Heats 7..10 (Fast): 8 entries.

            for (let i = 0; i < remainder; i++) {
                // Add to last heats: heatCount - 1 - i
                heatSizes[heatCount - 1 - i]++;
            }

            const remainingEntries = [...sorted]; // Sort: Best -> Worst

            // We fill from LAST heat (Fastest) to FIRST (Slowest)
            // Heat Last gets Top 'size' entries.
            for (let i = heatCount - 1; i >= 0; i--) {
                const size = heatSizes[i];
                const chunk = remainingEntries.splice(0, size);
                groupedHeats[i] = chunk;
            }

        } else if (method === 'BEST_FROM_FIRST') {
            // Goal: Fastest in FIRST heat.
            // Remainder (larger heats) should go to FIRST heats (Fastest).

            for (let i = 0; i < remainder; i++) {
                heatSizes[i]++;
            }

            const remainingEntries = [...sorted];

            // Fill from First
            for (let i = 0; i < heatCount; i++) {
                const size = heatSizes[i];
                const chunk = remainingEntries.splice(0, size);
                groupedHeats[i] = chunk;
            }
        }

        // 4. Assign Lanes and Persist
        // Lane order (Middle-Out preferences)
        const laneOrder = this.getLaneOrder(lanes, laneAssignment); // Use original 'lanes' for preferred lane assignment order
        // Note: max heat size might be > lanes if forced heats resulted in overcrowding.
        const maxHeatSize = Math.max(...groupedHeats.map(h => h.length));

        // Extend lane order linearly if needed
        for (let i = laneOrder.length + 1; i <= maxHeatSize; i++) {
            if (!laneOrder.includes(i)) laneOrder.push(i);
        }

        const updatePromises = [];
        let heatNumber = 1;

        for (const heatEntries of groupedHeats) {
            if (method !== 'RANDOM') {
                heatEntries.sort((a, b) => a.perfValue - b.perfValue);
            }

            // Assign lanes
            // Assign lanes
            for (let i = 0; i < heatEntries.length; i++) {
                const entry = heatEntries[i];
                // Get preferred lane based on rank (i)
                // If specific rules/lanes provided, use them.

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
        // Remove quotes (' or "), trim, uppercase, replace , with .
        const p = perf.trim().toUpperCase().replace(/['"]/g, '').replace(',', '.');

        if (['', 'NM', 'DNF', 'DNS', 'DQ', 'X', '-'].includes(p)) return Infinity;

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

    private getLaneOrder(lanes: number, assignment: string = 'STANDARD'): number[] {
        if (assignment === 'RANDOM') {
            const order = Array.from({ length: lanes }, (_, i) => i + 1);
            return order.sort(() => 0.5 - Math.random());
        }
        if (assignment === 'INSIDE_OUT') {
            return Array.from({ length: lanes }, (_, i) => i + 1);
        }

        // STANDARD (Middle-Out)
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

    async splitMultiEvent(id: string) {
        const mainEvent = await this.prisma.event.findUnique({
            where: { id },
            include: { entries: true }
        });

        if (!mainEvent) throw new Error('Event not found');

        const nameLower = mainEvent.name.toLowerCase();
        let subEvents: { name: string, code: string, wind?: boolean }[] = [];

        // 1. DECATHLON (M - Outdoor)
        if (nameLower.includes('dziesięciobój') || nameLower.includes('decathlon')) {
            subEvents = [
                { name: '100 m', code: '100', wind: true },
                { name: 'Skok w dal', code: 'LJ', wind: true },
                { name: 'Pchnięcie kulą', code: 'SP' },
                { name: 'Skok wzwyż', code: 'HJ' },
                { name: '400 m', code: '400' },
                { name: '110 m ppł', code: '110H', wind: true },
                { name: 'Rzut dyskiem', code: 'DT' },
                { name: 'Skok o tyczce', code: 'PV' },
                { name: 'Rzut oszczepem', code: 'JT' },
                { name: '1500 m', code: '1500' }
            ];
        }
        // 2. HEPTATHLON (K - Outdoor)
        else if ((nameLower.includes('siedmiobój') || nameLower.includes('heptathlon')) && mainEvent.gender === 'F') {
            subEvents = [
                { name: '100 m ppł', code: '100H', wind: true },
                { name: 'Skok wzwyż', code: 'HJ' },
                { name: 'Pchnięcie kulą', code: 'SP' },
                { name: '200 m', code: '200', wind: true },
                { name: 'Skok w dal', code: 'LJ', wind: true },
                { name: 'Rzut oszczepem', code: 'JT' },
                { name: '800 m', code: '800' }
            ];
        }
        // 3. HEPTATHLON (M - Indoor)
        else if ((nameLower.includes('siedmiobój') || nameLower.includes('heptathlon')) && mainEvent.gender === 'M') {
            subEvents = [
                { name: '60 m', code: '60' },
                { name: 'Skok w dal', code: 'LJ' },
                { name: 'Pchnięcie kulą', code: 'SP' },
                { name: 'Skok wzwyż', code: 'HJ' },
                { name: '60 m ppł', code: '60H' },
                { name: 'Skok o tyczce', code: 'PV' },
                { name: '1000 m', code: '1000' }
            ];
        }
        // 4. PENTATHLON (K - Indoor)
        else if (nameLower.includes('pięciobój') || nameLower.includes('pentathlon')) {
            subEvents = [
                { name: '60 m ppł', code: '60H' },
                { name: 'Skok wzwyż', code: 'HJ' },
                { name: 'Pchnięcie kulą', code: 'SP' },
                { name: 'Skok w dal', code: 'LJ' },
                { name: '800 m', code: '800' }
            ];
        }
        // 5. TETRATHLON (Polish Czwórbój U14)
        else if (nameLower.includes('czwórbój') || nameLower.includes('czworboj')) {
            subEvents = [
                { name: '60 m', code: '60', wind: true },
                { name: 'Skok w dal', code: 'LJ', wind: true },
                { name: 'Piłeczka palantowa', code: 'BX' },
                { name: mainEvent.gender === 'F' ? '600 m' : '1000 m', code: mainEvent.gender === 'F' ? '600' : '1000' }
            ];
        }
        // 6. PENTATHLON U16 (Outdoor Młodzicy)
        else if ((nameLower.includes('pięciobój') || nameLower.includes('piecioboj')) && (mainEvent.ageGroup === 'U16' || nameLower.includes('u16'))) {
            if (mainEvent.gender === 'F' || mainEvent.gender === 'K') {
                subEvents = [
                    { name: '80 m ppł', code: '80H', wind: true },
                    { name: 'Skok wzwyż', code: 'HJ' },
                    { name: 'Pchnięcie kulą', code: 'SP' },
                    { name: 'Skok w dal', code: 'LJ', wind: true },
                    { name: '600 m', code: '600' }
                ];
            } else {
                subEvents = [
                    { name: '110 m ppł', code: '110H', wind: true },
                    { name: 'Skok w dal', code: 'LJ', wind: true },
                    { name: 'Pchnięcie kulą', code: 'SP' },
                    { name: 'Skok wzwyż', code: 'HJ' },
                    { name: '1000 m', code: '1000' }
                ];
            }
        }

        if (subEvents.length === 0) {
            throw new Error('Could not identify sub-events for this competition type');
        }

        const results = [];
        for (const sub of subEvents) {
            // Identify model
            let model = 'STANDARD';
            const code = sub.code.toUpperCase();
            if (['LJ', 'TJ', 'SP', 'DT', 'JT', 'HT', 'BX'].includes(code)) model = 'FIELD_MULTI';
            else if (['HJ', 'PV'].includes(code)) model = 'VERTICAL_MULTI';
            else model = 'STANDARD';

            // Create sub-event
            const newEvent = await this.prisma.event.create({
                data: {
                    meetingId: mainEvent.meetingId,
                    name: `${sub.name} (${mainEvent.name})`,
                    code: sub.code,
                    eventCode: sub.code,
                    gender: mainEvent.gender,
                    ageGroup: mainEvent.ageGroup,
                    stage: 'Multi-Event',
                    model: model,
                    requiresWind: sub.wind || false,
                    startTime: mainEvent.startTime
                }
            });

            // Clone entries - we exclude PB/SB as they are for the whole multi-event
            const entryPromises = mainEvent.entries.map(entry => {
                const { id, eventId, createdAt, updatedAt, pb, sb, ...entryData } = entry;
                return this.prisma.entry.create({
                    data: {
                        ...entryData as any,
                        eventId: newEvent.id
                    }
                });
            });

            await Promise.all(entryPromises);
            results.push(newEvent);
        }

        return {
            message: `Successfully split into ${results.length} sub-events`,
            subEvents: results
        };
    }
}
