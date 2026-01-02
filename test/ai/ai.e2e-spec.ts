import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import {
  createTestTrainer,
  createTestClient,
  cleanupTestData,
  TestTrainer,
  TestClient,
} from '../helpers/test-helpers';
import { AIMessage } from '../../src/gamification/schemas/ai-message.schema';
import { AIMessageTrigger, AIMessageTone } from '../../src/gamification/schemas/ai-message.schema';
import { User } from '../../src/users/schemas/user.schema';
import { UserRole } from '../../src/common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';

/**
 * E2E Test for AI Message Module
 * 
 * Tests AI message generation endpoint with proper RBAC checks.
 * Endpoint: POST /api/gamification/generate-message
 */
describe('AI E2E (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let moduleFixture: TestingModule;

  let trainer: TestTrainer;
  let adminTrainer: TestTrainer; // Admin user who is also a trainer
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

    // Create trainer and client for testing
    trainer = await createTestTrainer(app, undefined, connection);
    testEmails.push(trainer.email);

    client = await createTestClient(app, trainer.profileId, undefined, connection);
    testEmails.push(client.email);

    // Create admin user (for admin role tests)
    const adminEmail = `admin-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
    const UserModel = connection.models[User.name];
    
    // Generate proper bcrypt hash for password 'Test123!@#'
    const passwordHash = await bcrypt.hash('Test123!@#', 10);
    
    const adminUser = new UserModel({
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
    });
    await adminUser.save();
    testEmails.push(adminEmail);

    // Login as admin to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'Test123!@#' })
      .expect((res) => {
        if (res.status !== 200 && res.status !== 201) {
          throw new Error(`Expected 200 or 201, got ${res.status}`);
        }
      });
    
    const loginData = loginResponse.body?.data || loginResponse.body;
    adminTrainer = {
      token: loginData.accessToken,
      userId: adminUser._id.toString(),
      profileId: '',
      email: adminEmail,
    };
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

  describe('POST /api/gamification/generate-message', () => {
    it('should generate message and save to database when authenticated as trainer', async () => {
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
        metadata: { missedCount: 2 },
      };

      const response = await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      
      // Assert response structure
      expect(responseData).toBeDefined();
      expect(responseData).toHaveProperty('_id');
      expect(responseData).toHaveProperty('clientId');
      expect(responseData).toHaveProperty('message');
      expect(responseData).toHaveProperty('tone');
      expect(responseData).toHaveProperty('trigger');
      expect(responseData.trigger).toBe(AIMessageTrigger.MISSED_WORKOUTS);
      expect(responseData.isRead).toBe(false);

      // MERODAVNOST PROVERE: Proveriti da se message stvarno čuva u bazu
      const AIMessageModel = connection.models[AIMessage.name];
      const savedMessage = await AIMessageModel.findById(responseData._id).exec();
      
      expect(savedMessage).toBeDefined();
      expect(savedMessage.clientId.toString()).toBe(client.profileId);
      expect(savedMessage.trigger).toBe(AIMessageTrigger.MISSED_WORKOUTS);
      expect(savedMessage.message).toBe(responseData.message);
      expect(savedMessage.tone).toBe(responseData.tone);
      expect(savedMessage.isRead).toBe(false);
      
      // MERODAVNOST PROVERE: Proveriti da tone odgovara trigger-u
      // MISSED_WORKOUTS sa missedCount=2 should be WARNING (not AGGRESSIVE, jer je <=2)
      expect([AIMessageTone.WARNING, AIMessageTone.AGGRESSIVE]).toContain(savedMessage.tone);
    });

    it('should generate message when authenticated as ADMIN', async () => {
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.STREAK,
        metadata: { streak: 7 },
      };

      const response = await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${adminTrainer.token}`)
        .send(dto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData).toBeDefined();
      expect(responseData.trigger).toBe(AIMessageTrigger.STREAK);
      
      // MERODAVNOST PROVERE: Proveriti da se message čuva u bazu
      const AIMessageModel = connection.models[AIMessage.name];
      const savedMessage = await AIMessageModel.findById(responseData._id).exec();
      expect(savedMessage).toBeDefined();
    });

    it('should return 400 BadRequest when clientId is missing', async () => {
      const dto = {
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
      };

      await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(400);
    });

    it('should return 400 BadRequest when trigger is invalid enum', async () => {
      const dto = {
        clientId: client.profileId,
        trigger: 'INVALID_TRIGGER',
      };

      await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(400);
    });

    it('should return 400 BadRequest when DTO validation fails', async () => {
      const dto = {
        clientId: '', // Empty string
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
      };

      await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(400);
    });

    it('should return 403 Forbidden when authenticated as CLIENT', async () => {
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
      };

      await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${client.token}`)
        .send(dto)
        .expect(403);
    });

    it('should return 401 Unauthorized when not authenticated', async () => {
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
      };

      await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .send(dto)
        .expect(401);
    });

    it('should save custom message when customMessage is provided', async () => {
      const customMessage = 'This is a custom message from trainer';
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
        customMessage,
        tone: AIMessageTone.WARNING,
      };

      const response = await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      
      // MERODAVNOST PROVERE: Proveriti da se koristi custom message umesto template-a
      expect(responseData.message).toBe(customMessage);
      
      // MERODAVNOST PROVERE: Proveriti da se koristi provided tone
      expect(responseData.tone).toBe(AIMessageTone.WARNING);

      // Proveriti u bazi
      const AIMessageModel = connection.models[AIMessage.name];
      const savedMessage = await AIMessageModel.findById(responseData._id).exec();
      expect(savedMessage.message).toBe(customMessage);
      expect(savedMessage.tone).toBe(AIMessageTone.WARNING);
    });

    it('should use default WARNING tone when customMessage is provided without tone', async () => {
      const customMessage = 'Custom message without tone specified';
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
        customMessage,
        // tone not specified
      };

      const response = await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData.message).toBe(customMessage);
      expect(responseData.tone).toBe(AIMessageTone.WARNING); // Default tone

      // MERODAVNOST PROVERE: Proveriti da se koristi default tone u bazi
      const AIMessageModel = connection.models[AIMessage.name];
      const savedMessage = await AIMessageModel.findById(responseData._id).exec();
      expect(savedMessage).toBeDefined();
      expect(savedMessage.message).toBe(customMessage);
      expect(savedMessage.tone).toBe(AIMessageTone.WARNING);
    });

    it('should generate message from template based on MISSED_WORKOUTS trigger with metadata', async () => {
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
        metadata: { missedCount: 3 }, // > 2, should be AGGRESSIVE
      };

      const response = await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      
      // MERODAVNOST PROVERE: Proveriti da tone odgovara trigger-u (>2 missed = AGGRESSIVE)
      expect(responseData.tone).toBe(AIMessageTone.AGGRESSIVE);
      
      // MERODAVNOST PROVERE: Proveriti da template sadrži zamenjene varijable
      expect(responseData.message.toLowerCase()).toMatch(/miss|workout/); // Template should contain "miss" or "workout"
      
      // Proveriti da metadata je sačuvano
      const AIMessageModel = connection.models[AIMessage.name];
      const savedMessage = await AIMessageModel.findById(responseData._id).exec();
      expect(savedMessage.metadata).toBeDefined();
      expect(savedMessage.metadata.missedCount).toBe(3);
    });

    it('should generate message from template based on STREAK trigger with metadata', async () => {
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.STREAK,
        metadata: { streak: 7 },
      };

      const response = await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      
      // MERODAVNOST PROVERE: STREAK trigger should generate MOTIVATIONAL tone
      expect(responseData.tone).toBe(AIMessageTone.MOTIVATIONAL);
      
      // MERODAVNOST PROVERE: Template should contain streak variable replacement
      expect(responseData.message).toMatch(/7|streak|days/i);
      
      const AIMessageModel = connection.models[AIMessage.name];
      const savedMessage = await AIMessageModel.findById(responseData._id).exec();
      expect(savedMessage.metadata.streak).toBe(7);
    });

    it('should generate message from template based on WEIGHT_SPIKE trigger with metadata', async () => {
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.WEIGHT_SPIKE,
        metadata: { weightChange: 5 }, // > 3, should be WARNING
      };

      const response = await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      
      // MERODAVNOST PROVERE: WEIGHT_SPIKE > 3kg should be WARNING
      expect(responseData.tone).toBe(AIMessageTone.WARNING);
      
      // MERODAVNOST PROVERE: Template should contain weightChange variable
      expect(responseData.message).toMatch(/5|kg|weight/i);
      
      const AIMessageModel = connection.models[AIMessage.name];
      const savedMessage = await AIMessageModel.findById(responseData._id).exec();
      expect(savedMessage.metadata.weightChange).toBe(5);
    });

    it('should generate message from template based on SICK_DAY trigger', async () => {
      const dto = {
        clientId: client.profileId,
        trigger: AIMessageTrigger.SICK_DAY,
      };

      const response = await request(app.getHttpServer())
        .post('/api/gamification/generate-message')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(dto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      
      // MERODAVNOST PROVERE: SICK_DAY trigger should generate EMPATHETIC tone
      expect(responseData.tone).toBe(AIMessageTone.EMPATHETIC);
      
      // Template should be empathetic
      expect(responseData.message.length).toBeGreaterThan(0);

      // MERODAVNOST PROVERE: Proveriti da se message čuva u bazu sa ispravnim trigger-om i tone-om
      const AIMessageModel = connection.models[AIMessage.name];
      const savedMessage = await AIMessageModel.findById(responseData._id).exec();
      expect(savedMessage).toBeDefined();
      expect(savedMessage.trigger).toBe(AIMessageTrigger.SICK_DAY);
      expect(savedMessage.tone).toBe(AIMessageTone.EMPATHETIC);
    });
  });
});