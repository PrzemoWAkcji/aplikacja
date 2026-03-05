import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const adminEmail = 'admin@athleticspro.pl';
    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail },
    });

    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                firstName: 'System',
                lastName: 'Admin',
                role: 'ADMIN',
            },
        });
        console.log('Test admin account created: admin@athleticspro.pl / admin123');
    } else {
        console.log('Admin account already exists.');
    }

    // Create Demo Meeting
    const admin = await prisma.user.findUnique({
        where: { email: adminEmail }
    });

    if (!admin) throw new Error('Admin not found');

    const demoMeeting = await prisma.meeting.upsert({
        where: { id: 'demo-meeting-1' },
        update: {},
        create: {
            id: 'demo-meeting-1',
            name: 'Mityng Testowy 2026',
            date: new Date('2026-05-15T10:00:00Z'),
            location: 'Warszawa',
            type: 'REGIONAL',
            organizerId: admin.id,
        }
    });

    console.log('Demo meeting created.');

    // Create Events
    const eventsData = [
        {
            id: 'event-100m-m',
            name: '100 metrów M',
            code: '100M',
            eventCode: '100',
            gender: 'M',
            meetingId: demoMeeting.id,
            lanes: 8,
            startTime: new Date('2026-05-15T11:00:00Z'),
        },
        {
            id: 'event-lj-m',
            name: 'Skok w dal M',
            code: 'LJM',
            eventCode: 'LJ',
            gender: 'M',
            meetingId: demoMeeting.id,
            trialsMode: '6', // Standard
            startTime: new Date('2026-05-15T12:00:00Z'),
        },
        {
            id: 'event-sp-k',
            name: 'Pchnięcie kulą K',
            code: 'SPK',
            eventCode: 'SP',
            gender: 'K',
            meetingId: demoMeeting.id,
            trialsMode: '3', // 3 Trials test
            startTime: new Date('2026-05-15T12:30:00Z'),
        },
        {
            id: 'event-hj-k',
            name: 'Skok wzwyż K',
            code: 'HJK',
            eventCode: 'HJ',
            gender: 'K',
            meetingId: demoMeeting.id,
            heights: JSON.stringify(['1.50', '1.55', '1.60', '1.65', '1.70', '1.75']),
            startTime: new Date('2026-05-15T13:00:00Z'),
        }
    ];

    for (const evt of eventsData) {
        await prisma.event.upsert({
            where: { id: evt.id },
            update: {},
            create: evt
        });
    }
    console.log('Demo events created.');

    // Create Entries
    // 100m Entries
    const entries100m = [
        { firstName: 'Jan', lastName: 'Kowalski', bib: '101', club: 'KS AZS AWF Warszawa', pb: '10.50', sb: '10.60', eventId: 'event-100m-m', lane: 4, heat: 1, countryCode: 'POL', yearOfBirth: 2005 },
        { firstName: 'Adam', lastName: 'Nowak', bib: '102', club: 'MKS Aleksandrów', pb: '10.80', sb: '10.95', eventId: 'event-100m-m', lane: 5, heat: 1, countryCode: 'POL', yearOfBirth: 2006 },
        { firstName: 'Piotr', lastName: 'Lewandowski', bib: '103', club: 'AZS Łódź', pb: '11.00', sb: '11.10', eventId: 'event-100m-m', lane: 3, heat: 1, countryCode: 'POL', yearOfBirth: 2004 },
    ];

    // LJ Entries
    const entriesLJ = [
        { firstName: 'Michał', lastName: 'Jumper', bib: '201', club: 'Skra Warszawa', pb: '7.50', sb: '7.40', eventId: 'event-lj-m', lane: 0, heat: 0, countryCode: 'POL', yearOfBirth: 2002 },
        { firstName: 'Tomasz', lastName: 'Lotny', bib: '202', club: 'Podlasie Białystok', pb: '7.20', sb: '', eventId: 'event-lj-m', lane: 0, heat: 0, countryCode: 'POL', yearOfBirth: 2003 },
    ];

    const allEntries = [...entries100m, ...entriesLJ];

    for (const entry of allEntries) {
        await prisma.entry.create({
            data: {
                firstName: entry.firstName,
                lastName: entry.lastName,
                athleteName: `${entry.lastName} ${entry.firstName}`, // Add required athleteName
                bib: entry.bib,
                club: entry.club,
                pb: entry.pb,
                sb: entry.sb,
                eventId: entry.eventId,
                lane: entry.lane || 0,
                heat: entry.heat || 0,
                status: 'CONFIRMED',
                countryCode: entry.countryCode,
                yearOfBirth: entry.yearOfBirth
            }
        });
    }
    console.log('Demo entries created.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
