import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e - mocked Prisma)', () => {
  let app: INestApplication;

  // Mock Prisma completely to bypass database connection issues in E2E
  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(null),
    $disconnect: jest.fn().mockResolvedValue(null),
    meeting: { findMany: jest.fn().mockResolvedValue([]) },
    event: { findFirst: jest.fn().mockResolvedValue(null) },
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

  it('/ (GET)', () => {
    return (request(app.getHttpServer() as any) as any)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
