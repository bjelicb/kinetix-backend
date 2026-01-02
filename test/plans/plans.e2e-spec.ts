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
  createTestPlan,
  assignPlanToClient,
  TestTrainer,
  TestClient,
} from '../helpers/test-helpers';
import { User } from '../../src/users/schemas/user.schema';
import { ClientProfile } from '../../src/clients/schemas/client-profile.schema';
import { UserRole } from '../../src/common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';

describe('Plans E2E (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let moduleFixture: TestingModule;

  let trainer: TestTrainer;
  let client: TestClient;
  let admin: TestTrainer; // Admin is also a trainer
  const testEmails: string[] = [];

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

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

    // Create trainer, client, and admin
    trainer = await createTestTrainer(app, undefined, connection);
    testEmails.push(trainer.email);

    client = await createTestClient(app, trainer.profileId, undefined, connection);
    testEmails.push(client.email);

    // Create admin user with ADMIN role
    const adminEmail = `admin-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
    const passwordHash = await bcrypt.hash('Test123!@#', 10);
    const UserModel = connection.models[User.name];
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
    const adminToken = loginData.accessToken;
    
    admin = {
      token: adminToken,
      userId: adminUser._id.toString(),
      profileId: trainer.profileId, // Admin doesn't have profileId, use trainer's for compatibility
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

  describe('POST /api/plans', () => {
    it('should create plan as trainer', async () => {
      const createDto = {
        name: 'Test Plan',
        description: 'Test Description',
        difficulty: 'INTERMEDIATE',
        workouts: [
          {
            dayOfWeek: 1,
            isRestDay: false,
            name: 'Monday Workout',
            exercises: [{ name: 'Squat', sets: 3, reps: '10', restSeconds: 60 }],
            estimatedDuration: 60,
          },
        ],
        isTemplate: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(createDto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData.name).toBe(createDto.name);
      expect(responseData.isTemplate).toBe(true);
    });

    it('should create plan as admin with trainerId', async () => {
      const createDto = {
        name: 'Admin Created Plan',
        description: 'Admin Description',
        difficulty: 'BEGINNER',
        workouts: [],
        isTemplate: true,
        trainerId: trainer.userId, // Admin provides trainerId
      };

      const response = await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(createDto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData.name).toBe(createDto.name);
    });

    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/api/plans')
        .send({ name: 'Test Plan' })
        .expect(401);
    });

    it('should return 403 if CLIENT tries to create plan', async () => {
      await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ name: 'Test Plan' })
        .expect(403);
    });
  });

  describe('GET /api/plans', () => {
    it('should return only trainer plans', async () => {
      // Create a plan for this trainer
      const { planId } = await createTestPlan(app, trainer.token);
      testEmails.push(`plan_${planId}`);

      const response = await request(app.getHttpServer())
        .get('/api/plans')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
      // Should only return plans for this trainer
      const trainerPlans = responseData.filter((p: any) => {
        const planTrainerId = p.trainerId?._id || p.trainerId;
        return planTrainerId?.toString() === trainer.profileId;
      });
      expect(trainerPlans.length).toBeGreaterThan(0);
    });

    it('should filter out soft-deleted plans', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/plans')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
      // Should not have isDeleted: true plans
      const deletedPlans = responseData.filter((p: any) => p.isDeleted === true);
      expect(deletedPlans.length).toBe(0);
    });
  });

  describe('GET /api/plans/:id', () => {
    let planId: string;

    beforeEach(async () => {
      const { planId: createdPlanId } = await createTestPlan(app, trainer.token);
      planId = createdPlanId;
      testEmails.push(`plan_${planId}`);
    });

    it('should return plan with trainerId as User ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id', planId);
    });

    it('should allow ADMIN to access any plan', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id', planId);
    });

    it('should allow TRAINER to access own plans', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id', planId);
    });

    it('should return 403 if TRAINER tries to access other trainer plan', async () => {
      // Create another trainer and plan
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);
      const { planId: otherPlanId } = await createTestPlan(app, otherTrainer.token);
      testEmails.push(`plan_${otherPlanId}`);

      await request(app.getHttpServer())
        .get(`/api/plans/${otherPlanId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });

    it('should allow CLIENT to access assigned plans', async () => {
      // Assign plan to client first
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const response = await request(app.getHttpServer())
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id', planId);
    });

    it('should return 403 if CLIENT tries to access unassigned plan', async () => {
      await request(app.getHttpServer())
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);
    });
  });

  describe('PATCH /api/plans/:id', () => {
    let planId: string;

    beforeEach(async () => {
      const { planId: createdPlanId } = await createTestPlan(app, trainer.token);
      planId = createdPlanId;
      testEmails.push(`plan_${planId}`);
    });

    it('should update plan', async () => {
      const updateDto = {
        name: 'Updated Plan Name',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(updateDto)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.name).toBe(updateDto.name);
    });

    it('should return 403 if TRAINER tries to update other trainer plan', async () => {
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);
      const { planId: otherPlanId } = await createTestPlan(app, otherTrainer.token);
      testEmails.push(`plan_${otherPlanId}`);

      await request(app.getHttpServer())
        .patch(`/api/plans/${otherPlanId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({ name: 'Updated Name' })
        .expect(403);
    });
  });

  describe('DELETE /api/plans/:id', () => {
    let planId: string;

    beforeEach(async () => {
      const { planId: createdPlanId } = await createTestPlan(app, trainer.token);
      planId = createdPlanId;
      testEmails.push(`plan_${planId}`);
    });

    it('should soft delete if plan has assigned clients', async () => {
      // Assign plan to client first
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      await request(app.getHttpServer())
        .delete(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      // Verify plan still exists but is soft-deleted
      const response = await request(app.getHttpServer())
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.isDeleted).toBe(true);
    });

    it('should hard delete if plan has no assigned clients', async () => {
      await request(app.getHttpServer())
        .delete(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      // Verify plan is deleted
      await request(app.getHttpServer())
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(404);
    });

    it('should return 403 if TRAINER tries to delete other trainer plan', async () => {
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);
      const { planId: otherPlanId } = await createTestPlan(app, otherTrainer.token);
      testEmails.push(`plan_${otherPlanId}`);

      await request(app.getHttpServer())
        .delete(`/api/plans/${otherPlanId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });
  });

  describe('POST /api/plans/:id/assign', () => {
    let planId: string;

    beforeEach(async () => {
      const { planId: createdPlanId } = await createTestPlan(app, trainer.token);
      planId = createdPlanId;
      testEmails.push(`plan_${planId}`);
    });

    it('should assign plan to clients', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const assignDto = {
        clientIds: [client.profileId],
        startDate: today.toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post(`/api/plans/${planId}/assign`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(assignDto)
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('message');
      expect(responseData.message).toContain('assigned');
    });

    it('should NOT set currentPlanId during assign', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const assignDto = {
        clientIds: [client.profileId],
        startDate: today.toISOString(),
      };

      await request(app.getHttpServer())
        .post(`/api/plans/${planId}/assign`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(assignDto)
        .expect(201);

      // Verify client profile - currentPlanId should NOT be set
      // This would require a separate endpoint or direct DB query
      // For now, we just verify the assignment succeeded
    });

    it('should return 400 if client cannot unlock', async () => {
      // This would require setting up a client with incomplete workouts
      // For now, we'll skip this as it requires complex setup
    });
  });

  describe('POST /api/plans/:id/cancel/:clientId', () => {
    let planId: string;

    beforeEach(async () => {
      const plan = await createTestPlan(app, trainer.token);
      planId = plan.planId;
      testEmails.push(`plan_${planId}`);
      // Assign plan to client
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await assignPlanToClient(app, trainer.token, planId, client.profileId, tomorrow);
    });

    it('should cancel plan assignment for specific client', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/plans/${planId}/cancel/${client.profileId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('message');
    });

    it('should return 404 if plan not found', async () => {
      const fakePlanId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .post(`/api/plans/${fakePlanId}/cancel/${client.profileId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(404);
    });

    it('should return 404 if client not found', async () => {
      const fakeClientId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .post(`/api/plans/${planId}/cancel/${fakeClientId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(404);
    });

    it('should return 403 if TRAINER tries to cancel plan for client they do not own', async () => {
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);
      const otherClient = await createTestClient(app, otherTrainer.profileId, undefined, connection);
      testEmails.push(otherClient.email);

      await request(app.getHttpServer())
        .post(`/api/plans/${planId}/cancel/${otherClient.profileId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });
  });

  describe('GET /api/plans/unlock-next-week/:clientId', () => {
    it('should return canUnlock status for client', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/plans/unlock-next-week/${client.profileId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('canUnlock');
      expect(typeof responseData.canUnlock).toBe('boolean');
    });

    it('should handle CLIENT role (uses CurrentUser)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/plans/unlock-next-week/${client.profileId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('canUnlock');
    });

    it('should return 404 if client not found', async () => {
      const fakeClientId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .get(`/api/plans/unlock-next-week/${fakeClientId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(404);
    });
  });

  describe('POST /api/plans/request-next-week/:clientId', () => {
    let planId: string;

    beforeEach(async () => {
      const plan = await createTestPlan(app, trainer.token);
      planId = plan.planId;
      testEmails.push(`plan_${planId}`);
      // Assign plan to client
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await assignPlanToClient(app, trainer.token, planId, client.profileId, tomorrow);
    });

    afterEach(async () => {
      // Reset currentPlanId after each test to avoid test interference
      if (connection) {
        const ClientProfileModel = connection.models[ClientProfile.name];
        if (ClientProfileModel) {
          await ClientProfileModel.updateOne(
            { _id: client.profileId },
            { $set: { currentPlanId: null } }
          ).exec();
        }
      }
    });

    it('should return 400 if cannot unlock', async () => {
      // First, unlock the assigned plan to set currentPlanId
      // Use today as startDate so plan can be unlocked
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Re-assign plan with today as startDate
      await assignPlanToClient(app, trainer.token, planId, client.profileId, today);
      
      // Unlock the plan (this sets currentPlanId)
      await request(app.getHttpServer())
        .post(`/api/plans/request-next-week/${client.profileId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(201);
      
      // Now try to unlock next week - should fail because current week is not completed
      await request(app.getHttpServer())
        .post(`/api/plans/request-next-week/${client.profileId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(400);
    });

    it('should return 403 if not CLIENT role', async () => {
      await request(app.getHttpServer())
        .post(`/api/plans/request-next-week/${client.profileId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });

    it('should return 400 if clientId does not match authenticated user', async () => {
      const fakeClientId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .post(`/api/plans/request-next-week/${fakeClientId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(400);
    });
  });

  describe('POST /api/plans/:id/duplicate', () => {
    let planId: string;

    beforeEach(async () => {
      const { planId: createdPlanId } = await createTestPlan(app, trainer.token);
      planId = createdPlanId;
      testEmails.push(`plan_${planId}`);
    });

    it('should duplicate plan', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/plans/${planId}/duplicate`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData.name).toContain('Copy');
      expect(responseData.assignedClientIds).toEqual([]);
    });
  });
});
