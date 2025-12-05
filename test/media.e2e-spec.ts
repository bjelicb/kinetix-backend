import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { SubscriptionStatus } from '../src/common/enums/subscription-status.enum';
import {
  createTestTrainer,
  createTestClient,
  cleanupTestData,
  TestTrainer,
  TestClient,
} from './helpers/test-helpers';

describe('Media E2E (e2e)', () => {
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

  describe('GET /api/media/signature', () => {
    it('should generate Cloudinary upload signature', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/media/signature')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('signature');
      expect(responseData).toHaveProperty('timestamp');
      expect(responseData).toHaveProperty('cloudName');
      expect(responseData).toHaveProperty('apiKey');
      expect(responseData).toHaveProperty('uploadPreset');
      expect(responseData).toHaveProperty('folder');
    });

    it('should return signature with required fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/media/signature')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      
      // Verify all required fields are present
      expect(typeof responseData.signature).toBe('string');
      expect(responseData.signature.length).toBeGreaterThan(0);
      expect(typeof responseData.timestamp).toBe('number');
      expect(typeof responseData.cloudName).toBe('string');
      expect(responseData.cloudName.length).toBeGreaterThan(0);
      expect(typeof responseData.apiKey).toBe('string');
      expect(responseData.apiKey.length).toBeGreaterThan(0);
      expect(typeof responseData.uploadPreset).toBe('string');
      expect(responseData.uploadPreset.length).toBeGreaterThan(0);
      expect(typeof responseData.folder).toBe('string');
      expect(responseData.folder).toContain('checkins/client_');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/media/signature')
        .expect(401);
    });

    it('should fail for trainer role (only CLIENT allowed)', async () => {
      await request(app.getHttpServer())
        .get('/api/media/signature')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });

    it('should fail when subscription is inactive (killswitch)', async () => {
      // Suspend trainer subscription
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: SubscriptionStatus.SUSPENDED,
          isActive: false,
        })
        .expect(200);

      // Client request should be blocked
      await request(app.getHttpServer())
        .get('/api/media/signature')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);

      // Reactivate for cleanup
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          isActive: true,
          subscriptionExpiresAt: futureDate.toISOString(),
        })
        .expect(200);
    });
  });
});
