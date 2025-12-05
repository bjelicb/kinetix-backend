import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SubscriptionStatus } from '../src/common/enums/subscription-status.enum';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import {
  createTestTrainer,
  createTestClient,
  cleanupTestData,
  TestTrainer,
  TestClient,
} from './helpers/test-helpers';

describe('Kill-Switch E2E (e2e)', () => {
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
    
    // Apply global interceptors (TransformInterceptor) for consistent response format
    app.useGlobalInterceptors(new TransformInterceptor());
    
    await app.init();

    connection = moduleFixture.get<Connection>(getConnectionToken());

    // Create trainer and client before all tests
    trainer = await createTestTrainer(app, undefined, connection);
    testEmails.push(trainer.email);

    client = await createTestClient(app, trainer.profileId, undefined, connection);
    testEmails.push(client.email);

    // Verify initial setup
    expect(trainer.token).toBeDefined();
    expect(trainer.userId).toBeDefined();
    expect(trainer.profileId).toBeDefined();
    expect(client.token).toBeDefined();
    expect(client.userId).toBeDefined();
    expect(client.profileId).toBeDefined();
  });

  afterAll(async () => {
    // Cleanup test data
    if (testEmails.length > 0 && connection) {
      await cleanupTestData(connection, testEmails);
    }

    // Close connections
    if (connection) {
      await connection.close();
    }
    if (app) {
      await app.close();
    }
  });

  describe('Setup: Verify trainer and client', () => {
    it('should have created trainer', () => {
      expect(trainer).toBeDefined();
      expect(trainer.token).toBeDefined();
      expect(trainer.userId).toBeDefined();
      expect(trainer.profileId).toBeDefined();
    });

    it('should have created client with trainer', async () => {
      expect(client).toBeDefined();
      expect(client.token).toBeDefined();
      expect(client.userId).toBeDefined();
      expect(client.profileId).toBeDefined();

      // Verify client can access profile
      await request(app.getHttpServer())
        .get('/api/clients/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);
    });
  });

  describe('Kill-Switch: Suspend trainer subscription', () => {
    it('should suspend trainer subscription', async () => {
      const subscriptionUpdate = {
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
        isActive: false,
      };

      const response = await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(subscriptionUpdate)
        .expect(200);

      expect(response.body.data.subscriptionStatus).toBe(SubscriptionStatus.SUSPENDED);
      expect(response.body.data.isActive).toBe(false);
    });

    it('should block client requests when trainer subscription is suspended', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('subscription is inactive');
    });

    it('should block client workout requests when trainer subscription is suspended', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/workouts/today')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('subscription is inactive');
    });
  });

  describe('Kill-Switch: Reactivate trainer subscription', () => {
    it('should reactivate trainer subscription', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now

      const subscriptionUpdate = {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        isActive: true,
        subscriptionExpiresAt: futureDate.toISOString(),
      };

      const response = await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(subscriptionUpdate)
        .expect(200);

      // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
      const responseData = response.body?.data || response.body;
      expect(responseData.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
      expect(responseData.isActive).toBe(true);
    });

    it('should allow client requests when trainer subscription is active', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
      const responseData = response.body?.data || response.body;
      expect(responseData).toBeDefined();
      expect(responseData).toHaveProperty('_id');
    });

    it('should allow client workout requests when trainer subscription is active', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/workouts/today')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
      const responseData = response.body?.data !== undefined ? response.body : { data: response.body };
      expect(responseData).toHaveProperty('data');
    });
  });

  describe('Kill-Switch: Expired subscription auto-suspend', () => {
    it('should auto-suspend expired subscription on client request', async () => {
      // Set subscription to expired using trainer endpoint
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // 1 day ago

      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          isActive: true,
          subscriptionExpiresAt: pastDate.toISOString(),
        })
        .expect(200);

      // Client request should trigger auto-suspend
      const response = await request(app.getHttpServer())
        .get('/api/clients/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('expired');

      // Verify subscription was auto-suspended by checking trainer profile
      const profileResponse = await request(app.getHttpServer())
        .get('/api/trainers/profile')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
      const profileData = profileResponse.body?.data || profileResponse.body;
      expect(profileData.subscriptionStatus).toBe(SubscriptionStatus.SUSPENDED);
      expect(profileData.isActive).toBe(false);
    });
  });
});

