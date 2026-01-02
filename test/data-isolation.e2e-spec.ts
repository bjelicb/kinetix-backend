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

/**
 * E2E Test for Data Isolation
 * 
 * Tests that:
 * 1. User A can only see their own workout logs
 * 2. User B can only see their own workout logs
 * 3. Users cannot access each other's data
 * 
 * This ensures that backend properly filters data by userId from JWT token.
 */
describe('Data Isolation E2E (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let moduleFixture: TestingModule;

  let trainerA: TestTrainer;
  let clientA: TestClient;
  let trainerB: TestTrainer;
  let clientB: TestClient;
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

    // Create two trainers and their clients
    trainerA = await createTestTrainer(app, undefined, connection);
    testEmails.push(trainerA.email);

    clientA = await createTestClient(app, trainerA.profileId, undefined, connection);
    testEmails.push(clientA.email);

    trainerB = await createTestTrainer(app, undefined, connection);
    testEmails.push(trainerB.email);

    clientB = await createTestClient(app, trainerB.profileId, undefined, connection);
    testEmails.push(clientB.email);
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

  describe('GET /api/clients/workouts/all - Data Isolation', () => {
    it('should return only client A workout logs when authenticated as client A', async () => {
      // Create and assign a plan to client A
      const { planId: planAId } = await createTestPlan(app, trainerA.token);
      await assignPlanToClient(app, trainerA.token, planAId, clientA.profileId);

      // Log a workout for client A
      const logDataA = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planAId,
        dayOfWeek: new Date().getDay() === 0 ? 7 : new Date().getDay(),
        completedExercises: [
          {
            exerciseName: 'Bench Press',
            actualSets: 3,
            actualReps: [10, 10, 8],
            weightUsed: 80,
          },
        ],
        isCompleted: true,
      };

      await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send(logDataA)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      // Get all workout logs for client A
      const response = await request(app.getHttpServer())
        .get('/api/clients/workouts/all')
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);

      // Verify all returned logs belong to client A
      if (responseData.length > 0) {
        responseData.forEach((log: any) => {
          // Verify clientId matches client A's profileId
          const logClientId = log.clientId?._id?.toString() || log.clientId?.toString() || log.clientId;
          expect(logClientId).toBe(clientA.profileId);
        });
      }
    });

    it('should return only client B workout logs when authenticated as client B', async () => {
      // Create and assign a plan to client B
      const { planId: planBId } = await createTestPlan(app, trainerB.token);
      await assignPlanToClient(app, trainerB.token, planBId, clientB.profileId);

      // Log a workout for client B
      const logDataB = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planBId,
        dayOfWeek: new Date().getDay() === 0 ? 7 : new Date().getDay(),
        completedExercises: [
          {
            exerciseName: 'Squats',
            actualSets: 4,
            actualReps: [12, 10, 8, 8],
            weightUsed: 100,
          },
        ],
        isCompleted: true,
      };

      await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${clientB.token}`)
        .send(logDataB)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      // Get all workout logs for client B
      const response = await request(app.getHttpServer())
        .get('/api/clients/workouts/all')
        .set('Authorization', `Bearer ${clientB.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);

      // Verify all returned logs belong to client B
      if (responseData.length > 0) {
        responseData.forEach((log: any) => {
          // Verify clientId matches client B's profileId
          const logClientId = log.clientId?._id?.toString() || log.clientId?.toString() || log.clientId;
          expect(logClientId).toBe(clientB.profileId);
        });
      }
    });

    it('should not return client A logs when authenticated as client B', async () => {
      // Get all workout logs for client B
      const response = await request(app.getHttpServer())
        .get('/api/clients/workouts/all')
        .set('Authorization', `Bearer ${clientB.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);

      // Verify no logs belong to client A
      if (responseData.length > 0) {
        responseData.forEach((log: any) => {
          const logClientId = log.clientId?._id?.toString() || log.clientId?.toString() || log.clientId;
          expect(logClientId).not.toBe(clientA.profileId);
          expect(logClientId).toBe(clientB.profileId);
        });
      }
    });

    it('should not return client B logs when authenticated as client A', async () => {
      // Get all workout logs for client A
      const response = await request(app.getHttpServer())
        .get('/api/clients/workouts/all')
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);

      // Verify no logs belong to client B
      if (responseData.length > 0) {
        responseData.forEach((log: any) => {
          const logClientId = log.clientId?._id?.toString() || log.clientId?.toString() || log.clientId;
          expect(logClientId).not.toBe(clientB.profileId);
          expect(logClientId).toBe(clientA.profileId);
        });
      }
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/clients/workouts/all')
        .expect(401);
    });

    it('should fail when subscription is inactive', async () => {
      // Suspend trainer A subscription
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainerA.token}`)
        .send({
          subscriptionStatus: 'SUSPENDED',
          isActive: false,
        })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/clients/workouts/all')
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(403);

      // Reactivate for cleanup
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainerA.token}`)
        .send({
          subscriptionStatus: 'ACTIVE',
          isActive: true,
          subscriptionExpiresAt: futureDate.toISOString(),
        })
        .expect(200);
    });
  });

  describe('GET /api/workouts/week/:date - Data Isolation', () => {
    it('should return only client A workouts for the week when authenticated as client A', async () => {
      const dateStr = new Date().toISOString().split('T')[0];
      
      const response = await request(app.getHttpServer())
        .get(`/api/workouts/week/${dateStr}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);

      // Verify all returned workouts belong to client A
      if (responseData.length > 0) {
        responseData.forEach((workout: any) => {
          const workoutClientId = workout.clientId?._id?.toString() || workout.clientId?.toString() || workout.clientId;
          expect(workoutClientId).toBe(clientA.profileId);
        });
      }
    });

    it('should return only client B workouts for the week when authenticated as client B', async () => {
      const dateStr = new Date().toISOString().split('T')[0];
      
      const response = await request(app.getHttpServer())
        .get(`/api/workouts/week/${dateStr}`)
        .set('Authorization', `Bearer ${clientB.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);

      // Verify all returned workouts belong to client B
      if (responseData.length > 0) {
        responseData.forEach((workout: any) => {
          const workoutClientId = workout.clientId?._id?.toString() || workout.clientId?.toString() || workout.clientId;
          expect(workoutClientId).toBe(clientB.profileId);
        });
      }
    });
  });

  describe('GET /api/workouts/today - Data Isolation', () => {
    it('should return only client A today workout when authenticated as client A', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/workouts/today')
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);

      const responseData = response.body?.data !== undefined ? response.body.data : response.body;
      
      // May be null if no workout for today
      if (responseData) {
        const workoutClientId = responseData.clientId?._id?.toString() || responseData.clientId?.toString() || responseData.clientId;
        expect(workoutClientId).toBe(clientA.profileId);
      }
    });

    it('should return only client B today workout when authenticated as client B', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/workouts/today')
        .set('Authorization', `Bearer ${clientB.token}`)
        .expect(200);

      const responseData = response.body?.data !== undefined ? response.body.data : response.body;
      
      // May be null if no workout for today
      if (responseData) {
        const workoutClientId = responseData.clientId?._id?.toString() || responseData.clientId?.toString() || responseData.clientId;
        expect(workoutClientId).toBe(clientB.profileId);
      }
    });
  });

  describe('GET /api/workouts/:id - Data Isolation', () => {
    it('should return only client A workout when authenticated as client A', async () => {
      // Create and assign a plan to client A
      const { planId: planAId } = await createTestPlan(app, trainerA.token);
      await assignPlanToClient(app, trainerA.token, planAId, clientA.profileId);

      // Log a workout for client A
      const logDataA = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planAId,
        dayOfWeek: new Date().getDay() === 0 ? 7 : new Date().getDay(),
        completedExercises: [
          {
            exerciseName: 'Bench Press',
            actualSets: 3,
            actualReps: [10, 10, 8],
            weightUsed: 80,
          },
        ],
        isCompleted: true,
      };

      const logResponse = await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send(logDataA)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const workoutLogId = logResponse.body?.data?._id || logResponse.body?._id || logResponse.body?.id;

      // Get workout by ID as client A
      const response = await request(app.getHttpServer())
        .get(`/api/workouts/${workoutLogId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      
      // Verify workout belongs to client A
      const workoutClientId = responseData.clientId?._id?.toString() || responseData.clientId?.toString() || responseData.clientId;
      expect(workoutClientId).toBe(clientA.profileId);
    });

    it('should return 403 Forbidden when client B tries to access client A workout', async () => {
      // Create and assign a plan to client A
      const { planId: planAId } = await createTestPlan(app, trainerA.token);
      await assignPlanToClient(app, trainerA.token, planAId, clientA.profileId);

      // Log a workout for client A
      const logDataA = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planAId,
        dayOfWeek: new Date().getDay() === 0 ? 7 : new Date().getDay(),
        completedExercises: [
          {
            exerciseName: 'Bench Press',
            actualSets: 3,
            actualReps: [10, 10, 8],
            weightUsed: 80,
          },
        ],
        isCompleted: true,
      };

      const logResponse = await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send(logDataA)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const workoutLogId = logResponse.body?.data?._id || logResponse.body?._id || logResponse.body?.id;

      // Try to get workout by ID as client B (should fail)
      await request(app.getHttpServer())
        .get(`/api/workouts/${workoutLogId}`)
        .set('Authorization', `Bearer ${clientB.token}`)
        .expect(403);
    });
  });

  describe('PATCH /api/workouts/:id - Data Isolation', () => {
    it('should update only client A workout when authenticated as client A', async () => {
      // Create and assign a plan to client A
      const { planId: planAId } = await createTestPlan(app, trainerA.token);
      await assignPlanToClient(app, trainerA.token, planAId, clientA.profileId);

      // Log a workout for client A
      const logDataA = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planAId,
        dayOfWeek: new Date().getDay() === 0 ? 7 : new Date().getDay(),
        completedExercises: [
          {
            exerciseName: 'Bench Press',
            actualSets: 3,
            actualReps: [10, 10, 8],
            weightUsed: 80,
          },
        ],
        isCompleted: false,
      };

      const logResponse = await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send(logDataA)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const workoutLogId = logResponse.body?.data?._id || logResponse.body?._id || logResponse.body?.id;

      // Update workout as client A
      const updateData = {
        isCompleted: true,
        completedExercises: [
          {
            exerciseName: 'Bench Press',
            actualSets: 3,
            actualReps: [12, 10, 8],
            weightUsed: 85,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/workouts/${workoutLogId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .send(updateData)
        .expect(200);

      const responseData = response.body?.data || response.body;
      
      // Verify workout belongs to client A and was updated
      const workoutClientId = responseData.clientId?._id?.toString() || responseData.clientId?.toString() || responseData.clientId;
      expect(workoutClientId).toBe(clientA.profileId);
      expect(responseData.isCompleted).toBe(true);
    });

    it('should return 403 Forbidden when client B tries to update client A workout', async () => {
      // Create and assign a plan to client A
      const { planId: planAId } = await createTestPlan(app, trainerA.token);
      await assignPlanToClient(app, trainerA.token, planAId, clientA.profileId);

      // Log a workout for client A
      const logDataA = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planAId,
        dayOfWeek: new Date().getDay() === 0 ? 7 : new Date().getDay(),
        completedExercises: [
          {
            exerciseName: 'Bench Press',
            actualSets: 3,
            actualReps: [10, 10, 8],
            weightUsed: 80,
          },
        ],
        isCompleted: false,
      };

      const logResponse = await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send(logDataA)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const workoutLogId = logResponse.body?.data?._id || logResponse.body?._id || logResponse.body?.id;

      // Try to update workout as client B (should fail)
      const updateData = {
        isCompleted: true,
      };

      await request(app.getHttpServer())
        .patch(`/api/workouts/${workoutLogId}`)
        .set('Authorization', `Bearer ${clientB.token}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('GET /api/checkins/:id - Data Isolation', () => {
    it('should return only client A check-in when authenticated as client A', async () => {
      // Create a check-in for client A
      const checkInDataA = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo-a.jpg',
        gpsCoordinates: {
          latitude: 10,
          longitude: 20,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send(checkInDataA)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = createResponse.body?.data?._id || createResponse.body?._id || createResponse.body?.id;

      // Get check-in by ID as client A
      const response = await request(app.getHttpServer())
        .get(`/api/checkins/${checkInId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      
      // Verify check-in belongs to client A
      const checkInClientId = responseData.clientId?._id?.toString() || responseData.clientId?.toString() || responseData.clientId;
      expect(checkInClientId).toBe(clientA.profileId);
    });

    it('should return 403 Forbidden when client B tries to access client A check-in', async () => {
      // Create a check-in for client A
      const checkInDataA = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo-a.jpg',
        gpsCoordinates: {
          latitude: 10,
          longitude: 20,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send(checkInDataA)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = createResponse.body?.data?._id || createResponse.body?._id || createResponse.body?.id;

      // Try to get check-in by ID as client B (should fail)
      await request(app.getHttpServer())
        .get(`/api/checkins/${checkInId}`)
        .set('Authorization', `Bearer ${clientB.token}`)
        .expect(403);
    });

    it('should return 403 Forbidden when trainer A tries to access trainer B client check-in', async () => {
      // Create a check-in for client B (trainer B's client)
      const checkInDataB = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo-b.jpg',
        gpsCoordinates: {
          latitude: 10,
          longitude: 20,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${clientB.token}`)
        .send(checkInDataB)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = createResponse.body?.data?._id || createResponse.body?._id || createResponse.body?.id;

      // Try to get check-in by ID as trainer A (should fail - check-in belongs to trainer B's client)
      await request(app.getHttpServer())
        .get(`/api/checkins/${checkInId}`)
        .set('Authorization', `Bearer ${trainerA.token}`)
        .expect(403);
    });
  });

  describe('GET /api/plans/:id - Data Isolation', () => {
    it('should return only trainer A plan when authenticated as trainer A', async () => {
      // Create a plan for trainer A
      const { planId: planAId } = await createTestPlan(app, trainerA.token);

      // Get plan by ID as trainer A
      const response = await request(app.getHttpServer())
        .get(`/api/plans/${planAId}`)
        .set('Authorization', `Bearer ${trainerA.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      
      // Verify plan belongs to trainer A
      // Plan has trainerProfileId which should match trainer A's profileId
      // Note: trainerId is User ID, trainerProfileId is TrainerProfile ID
      const planTrainerProfileId = responseData.trainerProfileId?.toString() || responseData.trainerProfileId;
      expect(planTrainerProfileId).toBe(trainerA.profileId);
    });

    it('should return 403 Forbidden when trainer B tries to access trainer A plan', async () => {
      // Create a plan for trainer A
      const { planId: planAId } = await createTestPlan(app, trainerA.token);

      // Try to get plan by ID as trainer B (should fail)
      await request(app.getHttpServer())
        .get(`/api/plans/${planAId}`)
        .set('Authorization', `Bearer ${trainerB.token}`)
        .expect(403);
    });
  });
});

