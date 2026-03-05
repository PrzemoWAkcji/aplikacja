import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Competition Flow (e2e - mocked Prisma)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(null),
    $disconnect: jest.fn().mockResolvedValue(null),
    meeting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    // Mock the specific ping check that Terminus indicators use
    // For many indicators, it checks if it can call certain methods.
    // Terminus Prisma indicator checks if the prisma object is an instance of a class with specific methods.
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
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

  it('/health (GET) - status check', async () => {
    const response = await (request(app.getHttpServer()) as any).get('/health');
    // We expect 200 or 503 depending on indicator success, but we want 200.
    // If it's 503, we inspect the body.
    if (response.status === 503) {
      console.log('Health Check Body:', JSON.stringify(response.body, null, 2));
    }
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('/meetings (GET) - public meetings list', () => {
    return (request(app.getHttpServer()) as any)
      .get('/meetings')
      .expect(200)
      .expect((res: any) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
