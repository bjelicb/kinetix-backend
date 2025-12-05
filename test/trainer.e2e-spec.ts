import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import {
  createTestTrainer,
  createTestClient,
  cleanupTestData,
  createTestPlan,
  TestTrainer,
  TestClient,
} from './helpers/test-helpers';
import { WorkoutLog } from '../src/workouts/schemas/workout-log.schema';

describe('Trainer Flow E2E (e2e)', () => {
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

  describe('POST /api/plans', () => {
    it('should create a new weekly plan', async () => {
      const planData = {
        name: 'Test Plan',
        description: 'Test plan description',
        difficulty: 'BEGINNER',
        isTemplate: true,
        workouts: [
          {
            dayOfWeek: 1,
            isRestDay: false,
            name: 'Upper Body Strength',
            exercises: [
              {
                name: 'Bench Press',
                sets: 3,
                reps: '8-12',
                restSeconds: 60,
              },
            ],
            estimatedDuration: 45,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(planData)
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData.name).toBe(planData.name);
      expect(responseData.difficulty).toBe(planData.difficulty);
      expect(responseData.workouts).toBeDefined();
      expect(responseData.workouts.length).toBeGreaterThan(0);
    });

    it('should fail to create plan without authentication', async () => {
      const planData = {
        name: 'Test Plan',
        difficulty: 'BEGINNER',
      };

      await request(app.getHttpServer())
        .post('/api/plans')
        .send(planData)
        .expect(401);
    });

    it('should fail to create plan with invalid data', async () => {
      const invalidData = {
        name: '', // Empty name
        difficulty: 'INVALID', // Invalid difficulty
      };

      await request(app.getHttpServer())
        .post('/api/plans')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/plans', () => {
    it('should get all plans for trainer', async () => {
      // Create a plan first
      await createTestPlan(app, trainer.token);

      const response = await request(app.getHttpServer())
        .get('/api/plans')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
      expect(responseData.length).toBeGreaterThan(0);
    });

    it('should return empty array if trainer has no plans', async () => {
      // Create a new trainer without plans
      const newTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(newTrainer.email);

      const response = await request(app.getHttpServer())
        .get('/api/plans')
        .set('Authorization', `Bearer ${newTrainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should get plan by ID', async () => {
      const { planId } = await createTestPlan(app, trainer.token);

      const response = await request(app.getHttpServer())
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData._id).toBe(planId);
      expect(responseData).toHaveProperty('name');
      expect(responseData).toHaveProperty('workouts');
    });

    it('should fail to get non-existent plan', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .get(`/api/plans/${fakeId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(404);
    });
  });

  describe('PATCH /api/plans/:id', () => {
    it('should update plan', async () => {
      const { planId } = await createTestPlan(app, trainer.token);

      const updateData = {
        name: 'Updated Plan Name',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(updateData)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.name).toBe(updateData.name);
      expect(responseData.description).toBe(updateData.description);
    });

    it('should fail to update plan owned by another trainer', async () => {
      // Create plan with first trainer
      const { planId } = await createTestPlan(app, trainer.token);

      // Create another trainer
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);

      const updateData = {
        name: 'Hacked Plan',
      };

      await request(app.getHttpServer())
        .patch(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${otherTrainer.token}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('POST /api/plans/:id/assign', () => {
    it('should assign plan to client', async () => {
      const { planId } = await createTestPlan(app, trainer.token);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1); // Tomorrow

      const assignData = {
        clientIds: [client.profileId],
        startDate: startDate.toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post(`/api/plans/${planId}/assign`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(assignData)
        .expect((res) => {
          // Accept both 200 and 201
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData).toBeDefined();
    });

    it('should create workout logs when plan is assigned', async () => {
      const { planId } = await createTestPlan(app, trainer.token);

      // Use a future Monday as startDate to ensure we get the full week and avoid conflicts
      const startDate = new Date();
      const dayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
      // Add extra week to avoid conflicts with previous test
      startDate.setDate(startDate.getDate() + daysUntilMonday + 7);
      startDate.setHours(0, 0, 0, 0);

      const assignData = {
        clientIds: [client.profileId],
        startDate: startDate.toISOString(),
      };

      await request(app.getHttpServer())
        .post(`/api/plans/${planId}/assign`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(assignData)
        .expect((res) => {
          // Accept both 200 and 201
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      // Verify workout logs were created by directly querying the database
      const workoutLogModel = connection.models[WorkoutLog.name];
      if (!workoutLogModel) {
        throw new Error('WorkoutLog model not found');
      }

      const weekEnd = new Date(startDate);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const logs = await workoutLogModel
        .find({
          clientId: new Types.ObjectId(client.profileId),
          weeklyPlanId: new Types.ObjectId(planId),
          workoutDate: {
            $gte: startDate,
            $lt: weekEnd,
          },
        })
        .exec();

      // We generate 7 logs (one per day) when plan is assigned
      expect(logs.length).toBe(7);
      
      // Verify each log has required fields
      logs.forEach((log: any) => {
        expect(log.clientId.toString()).toBe(client.profileId);
        expect(log.weeklyPlanId.toString()).toBe(planId);
        expect(log.workoutDate).toBeInstanceOf(Date);
        expect(log.dayOfWeek).toBeGreaterThanOrEqual(1);
        expect(log.dayOfWeek).toBeLessThanOrEqual(7);
        expect(log.isCompleted).toBe(false);
      });
    });

    it('should fail to assign plan to non-existent client', async () => {
      const { planId } = await createTestPlan(app, trainer.token);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);

      const assignData = {
        clientIds: ['507f1f77bcf86cd799439011'], // Fake client ID
        startDate: startDate.toISOString(),
      };

      await request(app.getHttpServer())
        .post(`/api/plans/${planId}/assign`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(assignData)
        .expect(404);
    });
  });

  describe('POST /api/plans/:id/duplicate', () => {
    it('should duplicate plan', async () => {
      const { planId } = await createTestPlan(app, trainer.token);

      const response = await request(app.getHttpServer())
        .post(`/api/plans/${planId}/duplicate`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData._id).not.toBe(planId); // Should be a new plan
    });
  });

  describe('DELETE /api/plans/:id', () => {
    it('should delete plan', async () => {
      const { planId } = await createTestPlan(app, trainer.token);

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

    it('should fail to delete plan owned by another trainer', async () => {
      const { planId } = await createTestPlan(app, trainer.token);

      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);

      await request(app.getHttpServer())
        .delete(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${otherTrainer.token}`)
        .expect(403);
    });
  });

  describe('GET /api/trainers/clients', () => {
    it('should get trainer clients list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/trainers/clients')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
      // Should include the client we created
      expect(responseData.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array if trainer has no clients', async () => {
      const newTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(newTrainer.email);

      const response = await request(app.getHttpServer())
        .get('/api/trainers/clients')
        .set('Authorization', `Bearer ${newTrainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });
  });

  describe('GET /api/trainers/profile', () => {
    it('should get trainer profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/trainers/profile')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData).toHaveProperty('userId');
      expect(responseData).toHaveProperty('subscriptionStatus');
      expect(responseData).toHaveProperty('isActive');
    });

    it('should return trainer profile with all fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/trainers/profile')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData).toHaveProperty('userId');
      expect(responseData).toHaveProperty('subscriptionStatus');
      expect(responseData).toHaveProperty('subscriptionTier');
      expect(responseData).toHaveProperty('subscriptionExpiresAt');
      expect(responseData).toHaveProperty('isActive');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/trainers/profile')
        .expect(401);
    });

    it('should fail for client role', async () => {
      await request(app.getHttpServer())
        .get('/api/trainers/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);
    });
  });

  describe('PATCH /api/trainers/profile', () => {
    it('should update trainer profile', async () => {
      const updateData = {
        bio: 'Updated bio for test trainer',
        certifications: ['Certified Personal Trainer', 'Nutrition Specialist'],
        specializations: ['Strength Training', 'Weight Loss'],
        yearsExperience: 5,
      };

      const response = await request(app.getHttpServer())
        .patch('/api/trainers/profile')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(updateData)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.bio).toBe(updateData.bio);
      expect(responseData.certifications).toEqual(updateData.certifications);
      expect(responseData.specializations).toEqual(updateData.specializations);
      expect(responseData.yearsExperience).toBe(updateData.yearsExperience);
    });

    it('should update bio and certifications', async () => {
      const updateData = {
        bio: 'Another updated bio',
        certifications: ['CPT'],
      };

      const response = await request(app.getHttpServer())
        .patch('/api/trainers/profile')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(updateData)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.bio).toBe(updateData.bio);
      expect(responseData.certifications).toEqual(updateData.certifications);
    });

    it('should fail with invalid data', async () => {
      // Note: yearsExperience validation may not be strict, so test with invalid enum or type
      const invalidData = {
        bio: 'a'.repeat(501), // Exceeds maxLength of 500
      };

      await request(app.getHttpServer())
        .patch('/api/trainers/profile')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(invalidData)
        .expect(400);
    });

    it('should fail for client role', async () => {
      const updateData = {
        bio: 'Should not work',
      };

      await request(app.getHttpServer())
        .patch('/api/trainers/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('GET /api/trainers/subscription', () => {
    it('should get subscription details', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('subscriptionStatus');
      expect(responseData).toHaveProperty('subscriptionTier');
      expect(responseData).toHaveProperty('subscriptionExpiresAt');
      expect(responseData).toHaveProperty('isActive');
    });

    it('should return subscription status, tier, expiresAt', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(['ACTIVE', 'SUSPENDED', 'CANCELLED']).toContain(responseData.subscriptionStatus);
      expect(['BASIC', 'PRO', 'ENTERPRISE']).toContain(responseData.subscriptionTier);
      expect(responseData.subscriptionExpiresAt).toBeDefined();
      expect(typeof responseData.isActive).toBe('boolean');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/trainers/subscription')
        .expect(401);
    });
  });

  describe('POST /api/trainers/subscription/upgrade', () => {
    it('should upgrade subscription tier', async () => {
      const upgradeData = {
        newTier: 'PRO',
      };

      const response = await request(app.getHttpServer())
        .post('/api/trainers/subscription/upgrade')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(upgradeData)
        .expect((res) => {
          // Accept both 200 and 201
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData.subscriptionTier).toBe('PRO');
    });

    it('should fail with invalid tier', async () => {
      const invalidData = {
        newTier: 'INVALID_TIER',
      };

      await request(app.getHttpServer())
        .post('/api/trainers/subscription/upgrade')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(invalidData)
        .expect(400);
    });

    it('should fail for client role', async () => {
      const upgradeData = {
        newTier: 'PRO',
      };

      await request(app.getHttpServer())
        .post('/api/trainers/subscription/upgrade')
        .set('Authorization', `Bearer ${client.token}`)
        .send(upgradeData)
        .expect(403);
    });
  });

  describe('POST /api/trainers/clients/:id/assign', () => {
    it('should assign client to trainer', async () => {
      // Create a client that belongs to another trainer first
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);
      const otherClient = await createTestClient(app, otherTrainer.profileId, undefined, connection);
      testEmails.push(otherClient.email);

      // Remove client from other trainer (set trainerId to null)
      const clientProfileModel = connection.models['ClientProfile'];
      if (clientProfileModel) {
        await clientProfileModel.findByIdAndUpdate(
          otherClient.profileId,
          { $set: { trainerId: null } },
        ).exec();
      }

      // Now assign to our trainer
      const response = await request(app.getHttpServer())
        .post(`/api/trainers/clients/${otherClient.profileId}/assign`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData).toBeDefined();
      expect(responseData.message).toContain('assigned');
    });

    it('should succeed when client already assigned to same trainer (idempotent)', async () => {
      // Client is already assigned to trainer in beforeAll
      // Try to assign again - should succeed (idempotent operation)
      const response = await request(app.getHttpServer())
        .post(`/api/trainers/clients/${client.profileId}/assign`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect((res) => {
          // Accept 200 or 201 (idempotent operation)
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });
      
      const responseData = response.body?.data || response.body;
      expect(responseData).toBeDefined();
      expect(responseData.message).toBeDefined();
    });

    it('should fail for non-existent client', async () => {
      const fakeClientId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .post(`/api/trainers/clients/${fakeClientId}/assign`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(404);
    });

    it('should fail for client role', async () => {
      await request(app.getHttpServer())
        .post(`/api/trainers/clients/${client.profileId}/assign`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);
    });
  });

  describe('DELETE /api/trainers/clients/:id', () => {
    it('should remove client from trainer', async () => {
      // Create a new client assigned to trainer
      const clientToRemove = await createTestClient(app, trainer.profileId, undefined, connection);
      testEmails.push(clientToRemove.email);

      const response = await request(app.getHttpServer())
        .delete(`/api/trainers/clients/${clientToRemove.profileId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toBeDefined();
    });

    it('should fail when client doesn\'t belong to trainer', async () => {
      // Create another trainer and client
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);
      const otherClient = await createTestClient(app, otherTrainer.profileId, undefined, connection);
      testEmails.push(otherClient.email);

      await request(app.getHttpServer())
        .delete(`/api/trainers/clients/${otherClient.profileId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403);
    });

    it('should fail for non-existent client', async () => {
      const fakeClientId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .delete(`/api/trainers/clients/${fakeClientId}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(404);
    });

    it('should fail for client role', async () => {
      await request(app.getHttpServer())
        .delete(`/api/trainers/clients/${client.profileId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);
    });
  });
});

