import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Competition Flow (mocked) (e2e)', () => {
    let app: INestApplication;

    const mockPrismaService = {
        meeting: {
            findMany: jest.fn().mockResolvedValue([]),
        },
        $connect: jest.fn().mockResolvedValue(null),
        $disconnect: jest.fn().mockResolvedValue(null),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(PrismaService)
            .useValue(mockPrismaService)
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    it('/meetings (GET)', () => {
        return request(app.getHttpServer() as any)
            .get('/meetings')
            .expect(200)
            .expect([]);
    });
});
