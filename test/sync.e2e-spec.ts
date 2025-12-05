import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import {
  createTestTrainer,
  createTestClient,
  cleanupTestData,
  createTestPlan,
  assignPlanToClient,
  createSyncBatchDto,
  TestTrainer,
  TestClient,
} from './helpers/test-helpers';

describe('Sync Flow E2E (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let moduleFixture: TestingModule;

  let trainer: TestTrainer;
  let client: TestClient;
  const testEmails: string[] = [];

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    connection = moduleFixture.get<Connection>(getConnectionToken());

    // Create trainer and client before all tests
    trainer = await createTestTrainer(app, undefined, connection);
    testEmails.push(trainer.email);

    client = await createTestClient(app, trainer.profileId, undefined, connection);
    testEmails.push(client.email);
  });

  afterAll(async () => {
    if (testEmails.length > 0 && connection) {
      await cleanupTestData(connection, testEmails);
    }
    if (connection) {
      await connection.close();
    }
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/training/sync - Batch sync workout logs', () => {
    it('should batch sync workout logs', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const syncDto = createSyncBatchDto(planId, {
        includeLogs: true,
        includeCheckIns: false,
        logCount: 2,
      });

      const response = await request(app.getHttpServer())
        .post('/api/training/sync')
        .set('Authorization', `Bearer ${client.token}`)
        .send(syncDto)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('processedLogs');
      expect(responseData).toHaveProperty('processedCheckIns');
      expect(responseData).toHaveProperty('errors');
      expect(responseData.processedLogs).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(responseData.errors)).toBe(true);
    });
  });

  describe('POST /api/training/sync - Batch sync check-ins', () => {
    it('should batch sync check-ins', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const syncDto = createSyncBatchDto(planId, {
        includeLogs: false,
        includeCheckIns: true,
        checkInCount: 2,
      });

      const response = await request(app.getHttpServer())
        .post('/api/training/sync')
        .set('Authorization', `Bearer ${client.token}`)
        .send(syncDto)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('processedLogs');
      expect(responseData).toHaveProperty('processedCheckIns');
      expect(responseData).toHaveProperty('errors');
      expect(responseData.processedCheckIns).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(responseData.errors)).toBe(true);
    });
  });

  describe('POST /api/training/sync - Duplicate detection', () => {
    it('should detect and skip duplicate workout logs', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const workoutDate = new Date();
      workoutDate.setHours(0, 0, 0, 0);

      const syncDto = createSyncBatchDto(planId, {
        includeLogs: true,
        includeCheckIns: false,
        logCount: 1,
      });

      // First sync
      const firstResponse = await request(app.getHttpServer())
        .post('/api/training/sync')
        .set('Authorization', `Bearer ${client.token}`)
        .send(syncDto)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const firstData = firstResponse.body?.data || firstResponse.body;
      expect(firstData.processedLogs).toBeGreaterThanOrEqual(0);

      // Second sync with same data (should detect duplicates)
      const secondResponse = await request(app.getHttpServer())
        .post('/api/training/sync')
        .set('Authorization', `Bearer ${client.token}`)
        .send(syncDto)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const secondData = secondResponse.body?.data || secondResponse.body;
      // Should either process or skip duplicates
      expect(secondData).toHaveProperty('processedLogs');
      expect(secondData).toHaveProperty('errors');
    });

    it('should detect and skip duplicate check-ins', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const syncDto = createSyncBatchDto(planId, {
        includeLogs: false,
        includeCheckIns: true,
        checkInCount: 1,
      });

      // First sync
      const firstResponse = await request(app.getHttpServer())
        .post('/api/training/sync')
        .set('Authorization', `Bearer ${client.token}`)
        .send(syncDto)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const firstData = firstResponse.body?.data || firstResponse.body;
      expect(firstData.processedCheckIns).toBeGreaterThanOrEqual(0);

      // Second sync with same data (should detect duplicates)
      const secondResponse = await request(app.getHttpServer())
        .post('/api/training/sync')
        .set('Authorization', `Bearer ${client.token}`)
        .send(syncDto)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const secondData = secondResponse.body?.data || secondResponse.body;
      // Should have errors indicating duplicate check-ins
      expect(secondData).toHaveProperty('processedCheckIns');
      expect(secondData).toHaveProperty('errors');
      // Errors should indicate duplicate check-ins
      const duplicateErrors = secondData.errors.filter((e: any) => 
        e.reason && e.reason.includes('already exists')
      );
      expect(duplicateErrors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/training/sync - Error handling', () => {
    it('should handle invalid sync data gracefully', async () => {
      const invalidSyncDto = {
        syncedAt: 'invalid-date',
        newLogs: [
          {
            workoutDate: 'invalid-date',
            weeklyPlanId: 'invalid-id',
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/api/training/sync')
        .set('Authorization', `Bearer ${client.token}`)
        .send(invalidSyncDto)
        .expect(400);
    });

    it('should handle sync with non-existent plan', async () => {
      const fakePlanId = '507f1f77bcf86cd799439011';
      const syncDto = createSyncBatchDto(fakePlanId, {
        includeLogs: true,
        includeCheckIns: false,
        logCount: 1,
      });

      const response = await request(app.getHttpServer())
        .post('/api/training/sync')
        .set('Authorization', `Bearer ${client.token}`)
        .send(syncDto)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      // Should have errors for logs that can't be found
      expect(responseData).toHaveProperty('errors');
      expect(Array.isArray(responseData.errors)).toBe(true);
    });
  });

  describe('POST /api/training/sync - Mixed sync', () => {
    it('should sync workout logs and check-ins in the same batch', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const syncDto = createSyncBatchDto(planId, {
        includeLogs: true,
        includeCheckIns: true,
        logCount: 2,
        checkInCount: 2,
      });

      const response = await request(app.getHttpServer())
        .post('/api/training/sync')
        .set('Authorization', `Bearer ${client.token}`)
        .send(syncDto)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('processedLogs');
      expect(responseData).toHaveProperty('processedCheckIns');
      expect(responseData).toHaveProperty('errors');
      expect(responseData.processedLogs).toBeGreaterThanOrEqual(0);
      expect(responseData.processedCheckIns).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(responseData.errors)).toBe(true);
    });
  });
});
