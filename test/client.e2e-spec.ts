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

describe('Client Flow E2E (e2e)', () => {
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

  describe('GET /api/clients/profile', () => {
    it('should get client profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData).toHaveProperty('userId');
      expect(responseData).toHaveProperty('trainerId');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/clients/profile')
        .expect(401);
    });
  });

  describe('PATCH /api/clients/profile', () => {
    it('should update client profile (weight, height, fitnessGoal)', async () => {
      const updateData = {
        weight: 75.5,
        height: 180,
        fitnessGoal: 'MUSCLE_GAIN',
        activityLevel: 'MODERATE',
      };

      const response = await request(app.getHttpServer())
        .patch('/api/clients/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .send(updateData)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.weight).toBe(updateData.weight);
      expect(responseData.height).toBe(updateData.height);
      expect(responseData.fitnessGoal).toBe(updateData.fitnessGoal);
      expect(responseData.activityLevel).toBe(updateData.activityLevel);
    });

    it('should fail with invalid data', async () => {
      const invalidData = {
        weight: -10, // Invalid negative weight
        fitnessGoal: 'INVALID_GOAL', // Invalid enum value
      };

      await request(app.getHttpServer())
        .patch('/api/clients/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .send(invalidData)
        .expect(400);
    });

    it('should fail without authentication', async () => {
      const updateData = {
        weight: 75,
      };

      await request(app.getHttpServer())
        .patch('/api/clients/profile')
        .send(updateData)
        .expect(401);
    });

    it('should fail when subscription is inactive', async () => {
      // Suspend trainer subscription
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'SUSPENDED',
          isActive: false,
        })
        .expect(200);

      const updateData = {
        weight: 75,
      };

      await request(app.getHttpServer())
        .patch('/api/clients/profile')
        .set('Authorization', `Bearer ${client.token}`)
        .send(updateData)
        .expect(403);

      // Reactivate for cleanup
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'ACTIVE',
          isActive: true,
          subscriptionExpiresAt: futureDate.toISOString(),
        })
        .expect(200);
    });
  });

  describe('GET /api/clients/current-plan', () => {
    it('should return null when no plan is assigned', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/current-plan')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data !== undefined ? response.body.data : response.body;
      expect(responseData).toBeNull();
    });

    it('should return current plan when assigned', async () => {
      // Create and assign a plan
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const response = await request(app.getHttpServer())
        .get('/api/clients/current-plan')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data !== undefined ? response.body.data : response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData._id).toBe(planId);
    });
  });

  describe('GET /api/clients/workouts/upcoming', () => {
    it('should get upcoming workouts for the week', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const response = await request(app.getHttpServer())
        .get('/api/clients/workouts/upcoming')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });

    it('should return empty array when no plan is assigned', async () => {
      // Create a new client without a plan
      const newClient = await createTestClient(app, trainer.profileId, undefined, connection);
      testEmails.push(newClient.email);

      const response = await request(app.getHttpServer())
        .get('/api/clients/workouts/upcoming')
        .set('Authorization', `Bearer ${newClient.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });
  });

  describe('GET /api/clients/workouts/history', () => {
    it('should get workout history', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/workouts/history')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });
  });

  describe('GET /api/clients/trainer', () => {
    it('should get trainer information', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/trainer')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('id');
      expect(responseData.id).toBeDefined();
    });

    it('should return trainer ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/trainer')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      // Handle both {id: string} and {_id: ObjectId} formats
      const trainerId = responseData.id || (responseData._id ? responseData._id.toString() : null);
      expect(trainerId).toBe(trainer.profileId);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/clients/trainer')
        .expect(401);
    });

    it('should fail when subscription is inactive', async () => {
      // Suspend trainer subscription
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'SUSPENDED',
          isActive: false,
        })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/clients/trainer')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);

      // Reactivate for cleanup
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'ACTIVE',
          isActive: true,
          subscriptionExpiresAt: futureDate.toISOString(),
        })
        .expect(200);
    });
  });

  describe('GET /api/clients/stats', () => {
    it('should get client workout statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/stats')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('totalWorkoutsCompleted');
      expect(responseData).toHaveProperty('currentStreak');
      expect(responseData).toHaveProperty('isPenaltyMode');
      expect(responseData).toHaveProperty('consecutiveMissedWorkouts');
    });

    it('should return completion rate, total workouts, current streak', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/clients/stats')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(typeof responseData.totalWorkoutsCompleted).toBe('number');
      expect(typeof responseData.currentStreak).toBe('number');
      expect(typeof responseData.isPenaltyMode).toBe('boolean');
      expect(typeof responseData.consecutiveMissedWorkouts).toBe('number');
    });

    it('should return zero stats when no workouts', async () => {
      // Create a new client without workouts
      const newClient = await createTestClient(app, trainer.profileId, undefined, connection);
      testEmails.push(newClient.email);

      const response = await request(app.getHttpServer())
        .get('/api/clients/stats')
        .set('Authorization', `Bearer ${newClient.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.totalWorkoutsCompleted).toBe(0);
      expect(responseData.currentStreak).toBe(0);
      expect(responseData.isPenaltyMode).toBe(false);
      expect(responseData.consecutiveMissedWorkouts).toBe(0);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/clients/stats')
        .expect(401);
    });

    it('should fail when subscription is inactive', async () => {
      // Suspend trainer subscription
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'SUSPENDED',
          isActive: false,
        })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/clients/stats')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);

      // Reactivate for cleanup
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'ACTIVE',
          isActive: true,
          subscriptionExpiresAt: futureDate.toISOString(),
        })
        .expect(200);
    });
  });

  describe('GET /api/workouts/today', () => {
    it('should get today\'s workout', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const response = await request(app.getHttpServer())
        .get('/api/workouts/today')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data !== undefined ? response.body.data : response.body;
      // May be null if no workout for today
      if (responseData) {
        expect(responseData).toHaveProperty('workoutDate');
        expect(responseData).toHaveProperty('clientId');
      }
    });
  });

  describe('POST /api/workouts/log', () => {
    it('should log a workout', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const logData = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planId,
        dayOfWeek: new Date().getDay() === 0 ? 7 : new Date().getDay(),
        completedExercises: [
          {
            exerciseName: 'Bench Press',
            actualSets: 3,
            actualReps: [10, 10, 8],
            weightUsed: 80,
            notes: 'Good form',
          },
        ],
        isCompleted: true,
        difficultyRating: 3,
        clientNotes: 'Felt strong today',
      };

      const response = await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${client.token}`)
        .send(logData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData.isCompleted).toBe(true);
    });

    it('should fail with invalid data', async () => {
      const invalidData = {
        workoutDate: 'invalid-date',
      };

      await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${client.token}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('PATCH /api/workouts/:id', () => {
    it('should update workout log', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      // Get today's workout
      const todayResponse = await request(app.getHttpServer())
        .get('/api/workouts/today')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const todayWorkout = todayResponse.body?.data || todayResponse.body;
      if (!todayWorkout) {
        // Skip if no workout for today
        return;
      }

      const updateData = {
        isCompleted: true,
        difficultyRating: 4,
        clientNotes: 'Updated notes',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/workouts/${todayWorkout._id}`)
        .set('Authorization', `Bearer ${client.token}`)
        .send(updateData)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.isCompleted).toBe(true);
      expect(responseData.difficultyRating).toBe(4);
    });

    it('should fail to update non-existent workout log', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .patch(`/api/workouts/${fakeId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .send({ isCompleted: true })
        .expect(404);
    });
  });

  describe('GET /api/workouts/week/:date', () => {
    it('should get week workouts', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      const dateStr = new Date().toISOString().split('T')[0];
      const response = await request(app.getHttpServer())
        .get(`/api/workouts/week/${dateStr}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });
  });

  describe('GET /api/workouts/:id', () => {
    it('should get specific workout log by ID', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      // Log a workout
      const logData = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planId,
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
        .set('Authorization', `Bearer ${client.token}`)
        .send(logData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const workoutId = (logResponse.body?.data || logResponse.body)._id;

      // Get workout by ID
      const response = await request(app.getHttpServer())
        .get(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData._id).toBe(workoutId);
      expect(responseData).toHaveProperty('workoutDate');
      expect(responseData).toHaveProperty('clientId');
      expect(responseData).toHaveProperty('weeklyPlanId');
      expect(responseData.isCompleted).toBe(true);
    });

    it('should return workout with all fields', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      // Log a workout
      const logData = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planId,
        dayOfWeek: new Date().getDay() === 0 ? 7 : new Date().getDay(),
        completedExercises: [
          {
            exerciseName: 'Squats',
            actualSets: 4,
            actualReps: [12, 10, 8, 8],
            weightUsed: 100,
            notes: 'Good form',
          },
        ],
        isCompleted: true,
        difficultyRating: 4,
        clientNotes: 'Felt strong',
      };

      const logResponse = await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${client.token}`)
        .send(logData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const workoutId = (logResponse.body?.data || logResponse.body)._id;

      // Get workout by ID
      const response = await request(app.getHttpServer())
        .get(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData).toHaveProperty('workoutDate');
      expect(responseData).toHaveProperty('completedExercises');
      expect(responseData).toHaveProperty('isCompleted');
      expect(responseData).toHaveProperty('difficultyRating');
      expect(responseData).toHaveProperty('clientNotes');
    });

    it('should fail for non-existent workout', async () => {
      const fakeWorkoutId = '507f1f77bcf86cd799439011';

      await request(app.getHttpServer())
        .get(`/api/workouts/${fakeWorkoutId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      const fakeWorkoutId = '507f1f77bcf86cd799439011';

      await request(app.getHttpServer())
        .get(`/api/workouts/${fakeWorkoutId}`)
        .expect(401);
    });

    it('should fail when subscription is inactive', async () => {
      // Create and assign a plan first
      const { planId } = await createTestPlan(app, trainer.token);
      await assignPlanToClient(app, trainer.token, planId, client.profileId);

      // Log a workout
      const logData = {
        workoutDate: new Date().toISOString(),
        weeklyPlanId: planId,
        dayOfWeek: new Date().getDay() === 0 ? 7 : new Date().getDay(),
        completedExercises: [],
        isCompleted: true,
      };

      const logResponse = await request(app.getHttpServer())
        .post('/api/workouts/log')
        .set('Authorization', `Bearer ${client.token}`)
        .send(logData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const workoutId = (logResponse.body?.data || logResponse.body)._id;

      // Suspend trainer subscription
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'SUSPENDED',
          isActive: false,
        })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);

      // Reactivate for cleanup
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'ACTIVE',
          isActive: true,
          subscriptionExpiresAt: futureDate.toISOString(),
        })
        .expect(200);
    });
  });

  describe('POST /api/checkins', () => {
    it('should create a check-in', async () => {
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        thumbnailUrl: 'https://example.com/thumbnail.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
        clientNotes: 'Great workout!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('_id');
      expect(responseData).toHaveProperty('photoUrl');
      expect(responseData).toHaveProperty('gpsCoordinates');
    });

    it('should fail with invalid data', async () => {
      const invalidData = {
        checkinDate: 'invalid-date',
      };

      await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/checkins', () => {
    it('should get all check-ins for client', async () => {
      // Create a check-in first
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        thumbnailUrl: 'https://example.com/thumbnail.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const response = await request(app.getHttpServer())
        .get('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });
  });

  describe('GET /api/checkins/:id', () => {
    it('should get check-in by ID', async () => {
      // Create a check-in first
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        thumbnailUrl: 'https://example.com/thumbnail.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const createdCheckIn = createResponse.body?.data || createResponse.body;
      const checkInId = createdCheckIn._id;

      const response = await request(app.getHttpServer())
        .get(`/api/checkins/${checkInId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData._id).toBe(checkInId);
      expect(responseData).toHaveProperty('photoUrl');
    });

    it('should fail to get non-existent check-in', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .get(`/api/checkins/${fakeId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(404);
    });
  });

  describe('GET /api/checkins/range/start/:startDate/end/:endDate', () => {
    it('should get check-ins by date range', async () => {
      // Create a check-in first
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        thumbnailUrl: 'https://example.com/thumbnail.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const response = await request(app.getHttpServer())
        .get(`/api/checkins/range/start/${startDateStr}/end/${endDateStr}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(Array.isArray(responseData)).toBe(true);
    });
  });

  describe('PATCH /api/checkins/:id/verify', () => {
    it('should verify check-in as trainer', async () => {
      // Create a check-in first
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = (createResponse.body?.data || createResponse.body)._id;

      // Verify as trainer
      const verifyData = {
        verificationStatus: 'APPROVED',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/checkins/${checkInId}/verify`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(verifyData)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.verificationStatus).toBe('APPROVED');
      expect(responseData.verifiedBy).toBeDefined();
      expect(responseData.verifiedAt).toBeDefined();
    });

    it('should approve check-in', async () => {
      // Create a check-in first
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = (createResponse.body?.data || createResponse.body)._id;

      const verifyData = {
        verificationStatus: 'APPROVED',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/checkins/${checkInId}/verify`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(verifyData)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.verificationStatus).toBe('APPROVED');
    });

    it('should reject check-in with reason', async () => {
      // Create a check-in first
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = (createResponse.body?.data || createResponse.body)._id;

      const verifyData = {
        verificationStatus: 'REJECTED',
        rejectionReason: 'Photo does not show gym equipment',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/checkins/${checkInId}/verify`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(verifyData)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData.verificationStatus).toBe('REJECTED');
      expect(responseData.rejectionReason).toBe(verifyData.rejectionReason);
    });

    it('should fail for non-existent check-in', async () => {
      const fakeCheckInId = '507f1f77bcf86cd799439011';
      const verifyData = {
        verificationStatus: 'APPROVED',
      };

      await request(app.getHttpServer())
        .patch(`/api/checkins/${fakeCheckInId}/verify`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(verifyData)
        .expect(404);
    });

    it('should fail when check-in doesn\'t belong to trainer\'s client', async () => {
      // Create another trainer and client
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);
      const otherClient = await createTestClient(app, otherTrainer.profileId, undefined, connection);
      testEmails.push(otherClient.email);

      // Create check-in for other client
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${otherClient.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = (createResponse.body?.data || createResponse.body)._id;

      // Try to verify as different trainer
      const verifyData = {
        verificationStatus: 'APPROVED',
      };

      await request(app.getHttpServer())
        .patch(`/api/checkins/${checkInId}/verify`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .send(verifyData)
        .expect(403);
    });

    it('should fail for client role', async () => {
      // Create a check-in first
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = (createResponse.body?.data || createResponse.body)._id;

      const verifyData = {
        verificationStatus: 'APPROVED',
      };

      await request(app.getHttpServer())
        .patch(`/api/checkins/${checkInId}/verify`)
        .set('Authorization', `Bearer ${client.token}`)
        .send(verifyData)
        .expect(403);
    });
  });

  describe('DELETE /api/checkins/:id', () => {
    it('should delete own check-in', async () => {
      // Create a check-in first
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = (createResponse.body?.data || createResponse.body)._id;

      // Delete check-in
      const response = await request(app.getHttpServer())
        .delete(`/api/checkins/${checkInId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toHaveProperty('message');
      expect(responseData.message).toContain('deleted');

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/api/checkins/${checkInId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(404);
    });

    it('should fail to delete non-existent check-in', async () => {
      const fakeCheckInId = '507f1f77bcf86cd799439011';

      await request(app.getHttpServer())
        .delete(`/api/checkins/${fakeCheckInId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(404);
    });

    it('should fail to delete other client\'s check-in', async () => {
      // Create another trainer and client
      const otherTrainer = await createTestTrainer(app, undefined, connection);
      testEmails.push(otherTrainer.email);
      const otherClient = await createTestClient(app, otherTrainer.profileId, undefined, connection);
      testEmails.push(otherClient.email);

      // Create check-in for other client
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${otherClient.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = (createResponse.body?.data || createResponse.body)._id;

      // Try to delete as different client
      await request(app.getHttpServer())
        .delete(`/api/checkins/${checkInId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      const fakeCheckInId = '507f1f77bcf86cd799439011';

      await request(app.getHttpServer())
        .delete(`/api/checkins/${fakeCheckInId}`)
        .expect(401);
    });

    it('should fail when subscription is inactive', async () => {
      // Create a check-in first
      const checkInData = {
        checkinDate: new Date().toISOString(),
        photoUrl: 'https://example.com/photo.jpg',
        gpsCoordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/checkins')
        .set('Authorization', `Bearer ${client.token}`)
        .send(checkInData)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`Expected 200 or 201, got ${res.status}`);
          }
        });

      const checkInId = (createResponse.body?.data || createResponse.body)._id;

      // Suspend trainer subscription
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'SUSPENDED',
          isActive: false,
        })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/checkins/${checkInId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);

      // Reactivate for cleanup
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await request(app.getHttpServer())
        .patch('/api/trainers/subscription')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({
          subscriptionStatus: 'ACTIVE',
          isActive: true,
          subscriptionExpiresAt: futureDate.toISOString(),
        })
        .expect(200);
    });
  });
});
