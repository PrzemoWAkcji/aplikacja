import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

describe('Competition Flow (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    it('/health (GET) - status check', () => {
        return request(app.getHttpServer() as any)
            .get('/health')
            .expect(200)
            .expect((res: any) => {
                expect(res.body.status).toBe('ok');
                expect(res.body.info.database.status).toBe('up');
            });
    });

    it('/meetings (GET) - public meetings list', () => {
        return request(app.getHttpServer() as any)
            .get('/meetings')
            .expect(200)
            .expect((res: any) => {
                expect(Array.isArray(res.body)).toBe(true);
            });
    });
});
