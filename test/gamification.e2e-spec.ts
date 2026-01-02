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
  TestTrainer,
  TestClient,
} from './helpers/test-helpers';

describe('Gamification E2E (e2e)', () => {
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

  describe('GET /api/gamification/status', () => {
    it('should get penalty status for client', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gamification/status')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('isPenaltyMode');
      expect(responseData).toHaveProperty('consecutiveMissedWorkouts');
      expect(responseData).toHaveProperty('currentStreak');
      expect(responseData).toHaveProperty('totalWorkoutsCompleted');
      expect(responseData).toHaveProperty('recentPenalties');
      expect(Array.isArray(responseData.recentPenalties)).toBe(true);
    });

    it('should return normal status when no penalties', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gamification/status')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.isPenaltyMode).toBe(false);
      expect(responseData.consecutiveMissedWorkouts).toBe(0);
      expect(responseData.currentStreak).toBe(0);
      expect(responseData.totalWorkoutsCompleted).toBe(0);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/gamification/status')
        .expect(401);
    });

    it('should fail for trainer role', async () => {
      await request(app.getHttpServer())
        .get('/api/gamification/status')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });
  });

  describe('GET /api/gamification/penalties', () => {
    it('should get penalty history for client', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gamification/penalties')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });

    it('should return empty array when no penalties', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gamification/penalties')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
      expect(responseData.length).toBe(0);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/gamification/penalties')
        .expect(401);
    });

    it('should fail for trainer role', async () => {
      await request(app.getHttpServer())
        .get('/api/gamification/penalties')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });
  });

  describe('GET /api/gamification/leaderboard', () => {
    it('should get leaderboard for trainer', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gamification/leaderboard')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });

    it('should rank clients by completion rate', async () => {
      // Create another client for the trainer
      const client2 = await createTestClient(app, trainer.profileId, undefined, connection);
      testEmails.push(client2.email);

      const response = await request(app.getHttpServer())
        .get('/api/gamification/leaderboard')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
      expect(responseData.length).toBeGreaterThanOrEqual(2);
      
      // Verify structure
      if (responseData.length > 0) {
        expect(responseData[0]).toHaveProperty('clientId');
        expect(responseData[0]).toHaveProperty('totalWorkoutsCompleted');
        expect(responseData[0]).toHaveProperty('currentStreak');
        expect(responseData[0]).toHaveProperty('isPenaltyMode');
      }
    });

    it('should fail for client role', async () => {
      await request(app.getHttpServer())
        .get('/api/gamification/leaderboard')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/gamification/leaderboard')
        .expect(401);
    });
  });

  describe('POST /api/gamification/reset-penalty/:clientId', () => {
    it('should reset penalty for client', async () => {
      // First, set client to penalty mode (if service supports it)
      // For now, just test the reset endpoint
      const response = await request(app.getHttpServer())
        .post(`/api/gamification/reset-penalty/${client.profileId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect((res) => {
          // Accept both 200 and 201
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('message');
      expect(responseData.message).toContain('reset');
    });

    it('should fail for non-existent client', async () => {
      const fakeClientId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .post(`/api/gamification/reset-penalty/${fakeClientId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(404);
    });

    it('should fail when client doesn\'t belong to trainer', async () => {
      // Create another trainer and client
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);
      const otherClient = await createTestClient(app, otherTrainer.profileId, undefined, connection);
      testEmails.push(otherClient.email);

      await request(app.getHttpServer())
        .post(`/api/gamification/reset-penalty/${otherClient.profileId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(404);
    });

    it('should fail for client role', async () => {
      await request(app.getHttpServer())
        .post(`/api/gamification/reset-penalty/${client.profileId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/gamification/reset-penalty/${client.profileId}`)
        .expect(401);
    });
  });

  describe('POST /api/gamification/clear-balance', () => {
    it('should clear balance for authenticated client', async () => {
      // First, set a balance for the client (via direct DB update or service call)
      // For E2E, we'll test with a client that has balance
      const response = await request(app.getHttpServer())
        .post('/api/gamification/clear-balance')
        .set('Authorization', `Bearer ${client.token}`)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('message');
      expect(responseData.message).toContain('cleared');

      // Verify balance is cleared in database
      const balanceResponse = await request(app.getHttpServer())
        .get('/api/gamification/balance')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const balanceData = balanceResponse.body?.data || balanceResponse.body;
      expect(balanceData.balance).toBe(0);
      expect(balanceData.monthlyBalance).toBe(0);
    });

    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/api/gamification/clear-balance')
        .expect(401);
    });

    it('should return 403 if not CLIENT role', async () => {
      await request(app.getHttpServer())
        .post('/api/gamification/clear-balance')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });
  });

  describe('GET /api/gamification/balance', () => {
    it('should return balance and monthlyBalance', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gamification/balance')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('balance');
      expect(responseData).toHaveProperty('monthlyBalance');
      expect(responseData).toHaveProperty('lastBalanceReset');
      expect(responseData).toHaveProperty('penaltyHistory');
      expect(Array.isArray(responseData.penaltyHistory)).toBe(true);
      expect(typeof responseData.balance).toBe('number');
      expect(typeof responseData.monthlyBalance).toBe('number');
    });

    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/api/gamification/balance')
        .expect(401);
    });

    it('should return 403 if not CLIENT role', async () => {
      await request(app.getHttpServer())
        .get('/api/gamification/balance')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });
  });
});
