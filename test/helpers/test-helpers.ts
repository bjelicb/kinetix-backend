import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Connection } from 'mongoose';
import { User } from '../../src/users/schemas/user.schema';
import { TrainerProfile } from '../../src/trainers/schemas/trainer-profile.schema';
import { ClientProfile } from '../../src/clients/schemas/client-profile.schema';
import { getConnectionToken } from '@nestjs/mongoose';

export interface TestTrainer {
  token: string;
  userId: string;
  profileId: string;
  email: string;
}

export interface TestClient {
  token: string;
  userId: string;
  profileId: string;
  email: string;
}

/**
 * Create a test trainer user
 * If email is provided and user exists, returns existing user data
 * Otherwise creates a new trainer with unique email
 */
export async function createTestTrainer(
  app: INestApplication<App>,
  email?: string,
  connection?: Connection,
): Promise<TestTrainer> {
  const trainerEmail = email || `trainer-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
  
  // Try to login first if email is provided (check if user exists)
  if (email) {
    try {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: trainerEmail, password: 'Test123!@#' })
        .expect(200);

      // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
      const loginData = loginResponse.body?.data || loginResponse.body;
      const token = loginData.accessToken;

      // Get trainer profile to extract IDs
      const profileResponse = await request(app.getHttpServer())
        .get('/api/trainers/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
      const profileData = profileResponse.body?.data || profileResponse.body;

      return {
        token,
        userId: profileData.userId,
        profileId: profileData._id,
        email: trainerEmail,
      };
    } catch (error) {
      // User doesn't exist or login failed, proceed to create new user
    }
  }

  // Create new trainer
  const trainerData = {
    email: trainerEmail,
    password: 'Test123!@#',
    role: 'TRAINER',
    firstName: 'Test',
    lastName: 'Trainer',
  };

  const registerResponse = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send(trainerData);

  if (registerResponse.status !== 201) {
    throw new Error(
      `Failed to register trainer: ${registerResponse.status} - ${JSON.stringify(registerResponse.body)}`,
    );
  }

  // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
  const responseData = registerResponse.body?.data || registerResponse.body;
  if (!responseData?.accessToken) {
    throw new Error(
      `Invalid register response: ${JSON.stringify(registerResponse.body)}`,
    );
  }

  const token = responseData.accessToken;

  // Get trainer profile to extract IDs
  // Try API first, fallback to direct DB access if guard blocks
  let profileData;
  try {
    const profileResponse = await request(app.getHttpServer())
      .get('/api/trainers/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    profileData = profileResponse.body?.data || profileResponse.body;
  } catch (error) {
    // If API fails, try direct DB access (for test setup only)
    if (connection) {
      const userModel = connection.models[User.name];
      const trainerModel = connection.models[TrainerProfile.name];
      if (userModel && trainerModel) {
        const user = await userModel.findOne({ email: trainerEmail }).exec();
        if (user) {
          const trainer = await trainerModel.findOne({ userId: user._id }).exec();
          if (trainer) {
            profileData = {
              userId: trainer.userId,
              _id: trainer._id,
            };
          }
        }
      }
    }
    if (!profileData) {
      throw error;
    }
  }

  return {
    token,
    userId: profileData.userId,
    profileId: profileData._id,
    email: trainerEmail,
  };
}

/**
 * Create a test client user with a trainer
 * If email is provided and user exists, returns existing user data
 * Otherwise creates a new client with unique email
 */
export async function createTestClient(
  app: INestApplication<App>,
  trainerProfileId: string,
  email?: string,
  connection?: Connection,
): Promise<TestClient> {
  const clientEmail = email || `client-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
  
  // Try to login first if email is provided (check if user exists)
  if (email) {
    try {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: clientEmail, password: 'Test123!@#' })
        .expect(200);

      // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
      const loginData = loginResponse.body?.data || loginResponse.body;
      const token = loginData.accessToken;

      // Get client profile to extract IDs
      const profileResponse = await request(app.getHttpServer())
        .get('/api/clients/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
      const profileData = profileResponse.body?.data || profileResponse.body;

      return {
        token,
        userId: profileData.userId,
        profileId: profileData._id,
        email: clientEmail,
      };
    } catch (error) {
      // User doesn't exist or login failed, proceed to create new user
    }
  }

  // Create new client
  const clientData = {
    email: clientEmail,
    password: 'Test123!@#',
    role: 'CLIENT',
    firstName: 'Test',
    lastName: 'Client',
    trainerId: trainerProfileId,
  };

  const registerResponse = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send(clientData);

  if (registerResponse.status !== 201) {
    throw new Error(
      `Failed to register client: ${registerResponse.status} - ${JSON.stringify(registerResponse.body)}`,
    );
  }

  // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
  const responseData = registerResponse.body?.data || registerResponse.body;
  if (!responseData?.accessToken) {
    throw new Error(
      `Invalid register response: ${JSON.stringify(registerResponse.body)}`,
    );
  }

  const token = responseData.accessToken;

  // Get client profile to extract IDs
  // Try API first, fallback to direct DB access if guard blocks
  let profileData;
  try {
    const profileResponse = await request(app.getHttpServer())
      .get('/api/clients/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    profileData = profileResponse.body?.data || profileResponse.body;
  } catch (error) {
    // If API fails (guard blocks), try direct DB access (for test setup only)
    if (connection) {
      const userModel = connection.models[User.name];
      const clientModel = connection.models[ClientProfile.name];
      if (userModel && clientModel) {
        const user = await userModel.findOne({ email: clientEmail }).exec();
        if (user) {
          const client = await clientModel.findOne({ userId: user._id }).exec();
          if (client) {
            profileData = {
              userId: client.userId,
              _id: client._id,
            };
          }
        }
      }
    }
    if (!profileData) {
      // If still no profile data, wait a bit and retry API
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        const retryResponse = await request(app.getHttpServer())
          .get('/api/clients/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        profileData = retryResponse.body?.data || retryResponse.body;
      } catch (retryError) {
        // Final fallback: try DB one more time
        if (connection) {
          const userModel = connection.models[User.name];
          const clientModel = connection.models[ClientProfile.name];
          if (userModel && clientModel) {
            const user = await userModel.findOne({ email: clientEmail }).exec();
            if (user) {
              const client = await clientModel.findOne({ userId: user._id }).exec();
              if (client) {
                profileData = {
                  userId: client.userId,
                  _id: client._id,
                };
              }
            }
          }
        }
        if (!profileData) {
          throw new Error(`Failed to get client profile after registration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
  }

  return {
    token,
    userId: profileData.userId,
    profileId: profileData._id,
    email: clientEmail,
  };
}

/**
 * Cleanup test data from database using MongoDB connection
 */
export async function cleanupTestData(
  connection: Connection,
  emails: string[],
): Promise<void> {
  if (emails.length === 0 || !connection) {
    return;
  }

  try {
    const userModel = connection.models[User.name];
    const trainerProfileModel = connection.models[TrainerProfile.name];
    const clientProfileModel = connection.models[ClientProfile.name];

    if (!userModel) {
      console.warn('User model not found for cleanup');
      return;
    }

    // Find users by email first
    const users = await userModel.find({ email: { $in: emails } }).exec();
    const userIds = users.map((u) => u._id);

    if (userIds.length === 0) {
      return;
    }

    // Delete trainer profiles
    if (trainerProfileModel) {
      await trainerProfileModel.deleteMany({ userId: { $in: userIds } });
    }

    // Delete client profiles
    if (clientProfileModel) {
      await clientProfileModel.deleteMany({ userId: { $in: userIds } });
    }

    // Delete users
    await userModel.deleteMany({ _id: { $in: userIds } });
  } catch (error) {
    console.warn('Error during test cleanup:', error);
    // Don't throw - cleanup errors shouldn't fail tests
  }
}

/**
 * Get authentication token by logging in
 */
export async function getAuthToken(
  app: INestApplication<App>,
  email: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  // Handle both formats: with TransformInterceptor (body.data) or without (body directly)
  const responseData = response.body?.data || response.body;
  return responseData.accessToken;
}

/**
 * Create a test weekly plan
 */
export async function createTestPlan(
  app: INestApplication<App>,
  trainerToken: string,
): Promise<{ planId: string; plan: any }> {
  const planData = {
    name: `Test Plan ${Date.now()}`,
    description: 'Test plan description',
    difficulty: 'BEGINNER',
    isTemplate: true,
    workouts: [
      {
        dayOfWeek: 1, // Monday
        isRestDay: false,
        name: 'Upper Body Strength',
        exercises: [
          {
            name: 'Bench Press',
            sets: 3,
            reps: '8-12',
            restSeconds: 60,
            notes: 'Focus on form',
          },
          {
            name: 'Pull-ups',
            sets: 3,
            reps: '10',
            restSeconds: 60,
          },
        ],
        estimatedDuration: 45,
      },
      {
        dayOfWeek: 2, // Tuesday
        isRestDay: false,
        name: 'Lower Body Strength',
        exercises: [
          {
            name: 'Squats',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
          },
        ],
        estimatedDuration: 40,
      },
      {
        dayOfWeek: 3, // Wednesday
        isRestDay: true,
        name: 'Rest Day',
      },
    ],
  };

  const response = await request(app.getHttpServer())
    .post('/api/plans')
    .set('Authorization', `Bearer ${trainerToken}`)
    .send(planData)
    .expect(201);

  const responseData = response.body?.data || response.body;
  return {
    planId: responseData._id || responseData.id,
    plan: responseData,
  };
}

/**
 * Assign a plan to a client
 */
export async function assignPlanToClient(
  app: INestApplication<App>,
  trainerToken: string,
  planId: string,
  clientProfileId: string,
  startDate?: Date,
): Promise<any> {
  const assignDate = startDate || new Date();
  assignDate.setDate(assignDate.getDate() + 1); // Tomorrow by default

  const assignData = {
    clientIds: [clientProfileId],
    startDate: assignDate.toISOString(),
  };

  const response = await request(app.getHttpServer())
    .post(`/api/plans/${planId}/assign`)
    .set('Authorization', `Bearer ${trainerToken}`)
    .send(assignData)
    .expect((res) => {
      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Expected 200 or 201, got ${res.status}`);
      }
    });

  return response.body?.data || response.body;
}

/**
 * Create a sync batch DTO for testing
 */
export function createSyncBatchDto(planId: string, options?: {
  includeLogs?: boolean;
  includeCheckIns?: boolean;
  logCount?: number;
  checkInCount?: number;
}): any {
  const { includeLogs = true, includeCheckIns = true, logCount = 2, checkInCount = 1 } = options || {};
  
  const syncDto: any = {
    syncedAt: new Date().toISOString(),
  };

  if (includeLogs) {
    const today = new Date();
    syncDto.newLogs = [];
    for (let i = 0; i < logCount; i++) {
      const workoutDate = new Date(today);
      workoutDate.setDate(workoutDate.getDate() + i);
      syncDto.newLogs.push({
        workoutDate: workoutDate.toISOString(),
        weeklyPlanId: planId,
        dayOfWeek: workoutDate.getDay() === 0 ? 7 : workoutDate.getDay(),
        completedExercises: [
          {
            exerciseName: 'Bench Press',
            actualSets: [3],
            actualReps: [10, 10, 8],
            weightUsed: [80],
            notes: 'Good form',
          },
        ],
        isCompleted: true,
        difficultyRating: 3,
        clientNotes: 'Great workout',
      });
    }
  }

  if (includeCheckIns) {
    syncDto.newCheckIns = [];
    for (let i = 0; i < checkInCount; i++) {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + i);
      syncDto.newCheckIns.push({
        checkinDate: checkInDate.toISOString(),
        photoUrl: `https://example.com/photo-${i}.jpg`,
        thumbnailUrl: `https://example.com/thumbnail-${i}.jpg`,
        gpsCoordinates: {
          latitude: 40.7128 + i * 0.01,
          longitude: -74.0060 + i * 0.01,
          accuracy: 10,
        },
        clientNotes: `Check-in ${i + 1}`,
      });
    }
  }

  return syncDto;
}

