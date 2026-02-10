import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

// Ensure DATABASE_URL is set for Prisma
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://admin:password@localhost:5432/aplikacja_db?schema=public';
}
