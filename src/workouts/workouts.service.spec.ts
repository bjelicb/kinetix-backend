import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { WorkoutsService } from './workouts.service';
import { WorkoutLog, WorkoutLogDocument } from './schemas/workout-log.schema';
import { ClientProfile } from '../clients/schemas/client-profile.schema';
import { WeeklyPlan } from '../plans/schemas/weekly-plan.schema';
import { ClientsService } from '../clients/clients.service';
import { PlansService } from '../plans/plans.service';
import { GamificationService } from '../gamification/gamification.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';

describe('WorkoutsService', () => {
  let service: WorkoutsService;
  let workoutLogModel: jest.Mocked<Model<WorkoutLogDocument>>;
  let module: TestingModule;

  const mockClientId = '507f1f77bcf86cd799439011';
  const mockUserId = '507f1f77bcf86cd799439015'; // userId (User._id)
  const mockTrainerId = '507f1f77bcf86cd799439012';
  const mockPlanId = '507f1f77bcf86cd799439013';
  const mockLogId = '507f1f77bcf86cd799439014';

  // Helper function to get a valid workout date (within last 30 days, not in future)
  const getValidWorkoutDate = (daysAgo: number = 0): Date => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const mockClientProfile: Partial<ClientProfile> = {
    _id: new Types.ObjectId(mockClientId),
    userId: new Types.ObjectId(mockUserId),
    trainerId: new Types.ObjectId(mockTrainerId),
  };

  const mockPlan: Partial<WeeklyPlan> = {
    _id: new Types.ObjectId(mockPlanId),
    trainerId: new Types.ObjectId(mockTrainerId),
    name: 'Test Plan',
    workouts: [
      {
        dayOfWeek: 1,
        name: 'Monday Workout',
        isRestDay: false,
        exercises: [
          { name: 'Squat', sets: 3, reps: '10', restSeconds: 60 },
        ],
        estimatedDuration: 60,
      },
      {
        dayOfWeek: 2,
        name: 'Tuesday Workout',
        isRestDay: false,
        exercises: [
          { name: 'Bench Press', sets: 3, reps: '8', restSeconds: 60 },
        ],
        estimatedDuration: 60,
      },
    ],
  };

  const mockWorkoutLog: Partial<WorkoutLogDocument> = {
    _id: new Types.ObjectId(mockLogId),
    clientId: new Types.ObjectId(mockClientId),
    trainerId: new Types.ObjectId(mockTrainerId),
    weeklyPlanId: new Types.ObjectId(mockPlanId),
    workoutDate: new Date('2024-01-01'),
    dayOfWeek: 1,
    isCompleted: false,
    isMissed: false,
    completedExercises: [],
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(async () => {
    const mockModelConstructor = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, ...mockWorkoutLog }),
    }));

    module = await Test.createTestingModule({
      providers: [
        WorkoutsService,
        {
          provide: getModelToken(WorkoutLog.name),
          useValue: mockModelConstructor,
        },
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
            getProfileById: jest.fn(),
          },
        },
        {
          provide: PlansService,
          useValue: {
            getPlanById: jest.fn(),
          },
        },
        {
          provide: GamificationService,
          useValue: {
            awardPoints: jest.fn(),
            addPenaltyToBalance: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkoutsService>(WorkoutsService);
    workoutLogModel = module.get(getModelToken(WorkoutLog.name));

    // Add methods to mockModelConstructor
    (workoutLogModel as any).findOne = jest.fn();
    (workoutLogModel as any).findById = jest.fn();
    (workoutLogModel as any).findByIdAndUpdate = jest.fn();
    (workoutLogModel as any).find = jest.fn();
    (workoutLogModel as any).insertMany = jest.fn();
    (workoutLogModel as any).updateMany = jest.fn();
    (workoutLogModel as any).deleteMany = jest.fn();
    (workoutLogModel as any).countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0), // Return 0 to avoid migration guard warning
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateWeeklyLogs', () => {
    it('should generate 7 workout logs for a week', async () => {
      const startDate = new Date('2024-01-01'); // Monday
      const mockLogs = Array.from({ length: 7 }, (_, i) => ({
        ...mockWorkoutLog,
        workoutDate: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
        dayOfWeek: i === 0 ? 1 : i + 1, // Monday = 1
      }));

      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // No existing logs
      });
      (workoutLogModel as any).insertMany.mockResolvedValue(mockLogs);

      const result = await service.generateWeeklyLogs(
        mockClientProfile as ClientProfile,
        mockPlan as WeeklyPlan,
        startDate,
      );

      expect((workoutLogModel as any).insertMany).toHaveBeenCalled();
      expect(result).toHaveLength(7);
      expect(result[0].dayOfWeek).toBe(1); // Monday
    });

    it('should map exercises from plan to completedExercises', async () => {
      const startDate = new Date('2024-01-01'); // Monday
      const mockLogs = [
        {
          ...mockWorkoutLog,
          workoutDate: startDate,
          dayOfWeek: 1,
          completedExercises: [
            {
              exerciseName: 'Squat',
              actualSets: 0,
              actualReps: [],
              weightUsed: undefined,
              notes: undefined,
            },
          ],
        },
      ];

      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // No existing logs
      });
      (workoutLogModel as any).insertMany.mockResolvedValue(mockLogs);

      const result = await service.generateWeeklyLogs(
        mockClientProfile as ClientProfile,
        mockPlan as WeeklyPlan,
        startDate,
      );

      expect(result[0].completedExercises).toHaveLength(1);
      expect(result[0].completedExercises[0].exerciseName).toBe('Squat');
    });

    it('should handle days without workouts (empty completedExercises)', async () => {
      const startDate = new Date('2024-01-01'); // Monday
      const planWithoutWednesday = {
        ...mockPlan,
        workouts: mockPlan.workouts?.filter((w) => w.dayOfWeek !== 3),
      };

      const mockLogs = Array.from({ length: 7 }, (_, i) => ({
        ...mockWorkoutLog,
        workoutDate: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
        dayOfWeek: i === 0 ? 1 : i + 1,
        completedExercises: i === 2 ? [] : [{ exerciseName: 'Test' }], // Wednesday (day 3) has no workout
      }));

      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // No existing logs
      });
      (workoutLogModel as any).insertMany.mockResolvedValue(mockLogs);

      const result = await service.generateWeeklyLogs(
        mockClientProfile as ClientProfile,
        planWithoutWednesday as WeeklyPlan,
        startDate,
      );

      expect(result[2].completedExercises).toEqual([]);
    });

    it('should throw Error if plan does not have workouts array', async () => {
      const startDate = new Date('2024-01-01');
      const planWithoutWorkouts = {
        ...mockPlan,
        workouts: null,
      };

      await expect(
        service.generateWeeklyLogs(
          mockClientProfile as ClientProfile,
          planWithoutWorkouts as WeeklyPlan,
          startDate,
        ),
      ).rejects.toThrow('Plan does not have valid workouts array');
    });

    it('should throw Error if client does not have trainerId', async () => {
      const startDate = new Date('2024-01-01');
      const clientWithoutTrainer = {
        ...mockClientProfile,
        trainerId: undefined,
      };

      await expect(
        service.generateWeeklyLogs(
          clientWithoutTrainer as ClientProfile,
          mockPlan as WeeklyPlan,
          startDate,
        ),
      ).rejects.toThrow('Client does not have a trainer assigned');
    });

    it('should throw Error if trainer ID format is invalid', async () => {
      const startDate = new Date('2024-01-01');
      const clientWithInvalidTrainerId = {
        ...mockClientProfile,
        trainerId: 'invalid-id',
      };

      await expect(
        service.generateWeeklyLogs(
          clientWithInvalidTrainerId as ClientProfile,
          mockPlan as WeeklyPlan,
          startDate,
        ),
      ).rejects.toThrow('Invalid trainer ID format');
    });

    it('should throw Error if plan ID is missing', async () => {
      const startDate = new Date('2024-01-01');
      const planWithoutId = {
        ...mockPlan,
        _id: undefined,
        id: undefined,
      };

      await expect(
        service.generateWeeklyLogs(
          mockClientProfile as ClientProfile,
          planWithoutId as WeeklyPlan,
          startDate,
        ),
      ).rejects.toThrow('Plan ID is missing');
    });

    it('should not create duplicate workout log if one already exists', async () => {
      const startDate = new Date('2024-01-01');
      const existingLog = {
        ...mockWorkoutLog,
        workoutDate: startDate,
        save: jest.fn().mockResolvedValue(mockWorkoutLog),
      };

      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingLog), // Existing log found
      });
      (workoutLogModel as any).insertMany.mockResolvedValue([]);

      const result = await service.generateWeeklyLogs(
        mockClientProfile as ClientProfile,
        mockPlan as WeeklyPlan,
        startDate,
      );

      // Should update existing log instead of creating new one
      expect(existingLog.save).toHaveBeenCalled();
    });
  });

  describe('logWorkout', () => {
    it('should create a new workout log', async () => {
      // Use a valid date within last 30 days (15 days ago)
      const validDate = getValidWorkoutDate(15);
      const logDto: LogWorkoutDto = {
        workoutDate: validDate.toISOString(), // Service expects ISO string
        dayOfWeek: 1,
        weeklyPlanId: mockPlanId,
        completedExercises: [],
        isCompleted: true,
      };

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const mockInstance = {
        ...logDto,
        _id: new Types.ObjectId(), // Add _id for service logging
        save: jest.fn().mockResolvedValue({ ...mockWorkoutLog, _id: new Types.ObjectId(), ...logDto }),
      };
      (workoutLogModel as any).mockImplementation(() => mockInstance);

      const result = await service.logWorkout(mockClientId, logDto);

      expect((workoutLogModel as any).findOne).toHaveBeenCalled();
      expect(mockInstance.save).toHaveBeenCalled();
      expect(result.isCompleted).toBe(true);
    });

    it('should update existing workout log', async () => {
      // Use a valid date within last 30 days (10 days ago)
      const validDate = getValidWorkoutDate(10);
      const logDto: LogWorkoutDto = {
        workoutDate: validDate.toISOString(), // Service expects ISO string
        dayOfWeek: 1,
        weeklyPlanId: mockPlanId,
        completedExercises: [{ exerciseName: 'Squat', actualSets: 3, actualReps: [10, 10, 10] }],
        isCompleted: true,
      };

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      const existingLog = {
        ...mockWorkoutLog,
        workoutDate: validDate,
        completedExercises: [],
        isCompleted: false,
        save: jest.fn().mockResolvedValue({ ...mockWorkoutLog, ...logDto }),
      };

      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingLog),
      });

      const result = await service.logWorkout(mockClientId, logDto);

      expect(existingLog.save).toHaveBeenCalled();
      expect(result.isCompleted).toBe(true);
      expect(result.completedExercises).toEqual(logDto.completedExercises);
    });

    it('should normalize workoutDate to start of day', async () => {
      // Use a recent date (within 30 days) to avoid validation error
      const today = new Date();
      const workoutDateWithTime = new Date(today);
      workoutDateWithTime.setHours(14, 30, 0, 0);
      
      const logDto: LogWorkoutDto = {
        workoutDate: workoutDateWithTime.toISOString(), // Service expects ISO string
        dayOfWeek: 1,
        weeklyPlanId: mockPlanId,
        completedExercises: [],
        isCompleted: true,
      };

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const normalizedDate = new Date(workoutDateWithTime);
      normalizedDate.setUTCHours(0, 0, 0, 0);
      const mockInstance = {
        ...logDto,
        _id: new Types.ObjectId(),
        workoutDate: normalizedDate,
        save: jest.fn().mockResolvedValue({ ...mockWorkoutLog, _id: new Types.ObjectId(), workoutDate: normalizedDate }),
      };
      (workoutLogModel as any).mockImplementation(() => mockInstance);

      const result = await service.logWorkout(mockClientId, logDto);

      // Verify that findOne was called with range query (normalized date)
      expect((workoutLogModel as any).findOne).toHaveBeenCalled();
      const findOneCall = (workoutLogModel as any).findOne.mock.calls[0][0];
      expect(findOneCall.workoutDate).toHaveProperty('$gte');
      expect(findOneCall.workoutDate).toHaveProperty('$lt');
    });

    it('should find existing log with different time same day using range query', async () => {
      // Use a valid date within last 30 days (5 days ago)
      const validDate = getValidWorkoutDate(5);
      const validDateEndOfDay = new Date(validDate);
      validDateEndOfDay.setHours(23, 59, 59, 999);
      const logDto: LogWorkoutDto = {
        workoutDate: validDateEndOfDay.toISOString(), // Service expects ISO string
        dayOfWeek: 1,
        weeklyPlanId: mockPlanId,
        completedExercises: [],
        isCompleted: true,
      };

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      const existingLog = {
        ...mockWorkoutLog,
        workoutDate: validDate, // Existing log with normalized date
        completedExercises: [],
        isCompleted: false,
        save: jest.fn().mockResolvedValue({ ...mockWorkoutLog, ...logDto }),
      };

      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingLog),
      });

      const result = await service.logWorkout(mockClientId, logDto);

      // Verify that existing log was found (range query works)
      expect(existingLog.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw Error if workout date is in the future (CLIENT role)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
      const logDto: LogWorkoutDto = {
        workoutDate: futureDate.toISOString(),
        dayOfWeek: 1,
        weeklyPlanId: mockPlanId,
        completedExercises: [],
        isCompleted: true,
      };

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);

      await expect(service.logWorkout(mockClientId, logDto, 'CLIENT')).rejects.toThrow(
        'Cannot log workout for future dates',
      );
    });

    it('should allow future dates for TRAINER role', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const logDto: LogWorkoutDto = {
        workoutDate: futureDate.toISOString(),
        dayOfWeek: 1,
        weeklyPlanId: mockPlanId,
        completedExercises: [],
        isCompleted: true,
      };

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const mockInstance = {
        ...logDto,
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue({ ...mockWorkoutLog, _id: new Types.ObjectId(), ...logDto }),
      };
      (workoutLogModel as any).mockImplementation(() => mockInstance);

      const result = await service.logWorkout(mockClientId, logDto, 'TRAINER');

      expect(mockInstance.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle PlansService error when getting plan', async () => {
      const validDate = getValidWorkoutDate(10);
      const logDto: LogWorkoutDto = {
        workoutDate: validDate.toISOString(),
        dayOfWeek: 1,
        weeklyPlanId: mockPlanId,
        completedExercises: [],
        isCompleted: true,
      };

      const clientsService = module.get<ClientsService>(ClientsService);
      const plansService = module.get<PlansService>(PlansService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (plansService.getPlanById as jest.Mock).mockRejectedValue(new Error('Plan not found'));

      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const mockInstance = {
        ...logDto,
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue({ ...mockWorkoutLog, _id: new Types.ObjectId(), ...logDto }),
      };
      (workoutLogModel as any).mockImplementation(() => mockInstance);

      // Service should still create log even if plan fetch fails (enrichment is optional)
      const result = await service.logWorkout(mockClientId, logDto);

      expect(mockInstance.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('updateWorkoutLog', () => {
    it('should update workout log', async () => {
      const updateDto: UpdateWorkoutLogDto = {
        isCompleted: true,
        completedExercises: [{ exerciseName: 'Squat', actualSets: 3, actualReps: [10, 10, 10] }],
      };

      // Service first calls findById(...).exec() to get existing log
      (workoutLogModel as any).findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWorkoutLog),
      });

      const updatedLog = { ...mockWorkoutLog, ...updateDto };
      (workoutLogModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedLog),
      });

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);

      const result = await service.updateWorkoutLog(mockLogId, updateDto, mockUserId);

      expect((workoutLogModel as any).findById).toHaveBeenCalledWith(mockLogId);
      expect(clientsService.getProfile).toHaveBeenCalledWith(mockUserId);
      // Service dodaje isMissed: false kada se isCompleted postavlja na true (data consistency)
      const expectedUpdate = {
        ...updateDto,
        isMissed: false, // Service automatski dodaje ovo polje
      };
      expect((workoutLogModel as any).findByIdAndUpdate).toHaveBeenCalledWith(
        mockLogId,
        { $set: expectedUpdate },
        { new: true },
      );
      expect(result.isCompleted).toBe(true);
    });

    it('should throw NotFoundException if log not found', async () => {
      // Service first calls findById(...).exec() to get existing log
      (workoutLogModel as any).findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // Log not found
      });

      await expect(
        service.updateWorkoutLog(mockLogId, { isCompleted: true }, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if workout does not belong to user', async () => {
      const otherClientId = '507f1f77bcf86cd799439020';
      const otherUserId = '507f1f77bcf86cd799439021';
      const otherClientProfile: Partial<ClientProfile> = {
        _id: new Types.ObjectId(otherClientId),
        userId: new Types.ObjectId(otherUserId),
      };

      // Log belongs to mockClientId, but user is otherUserId
      (workoutLogModel as any).findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWorkoutLog),
      });

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(otherClientProfile as any);

      await expect(
        service.updateWorkoutLog(mockLogId, { isCompleted: true }, otherUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should normalize workoutDate before update', async () => {
      const updateDto: UpdateWorkoutLogDto = {
        workoutDate: new Date('2024-01-01T14:30:00.000Z'), // Date with time
        isCompleted: true,
      };

      const normalizedDate = new Date('2024-01-01T00:00:00.000Z');
      const updatedLog = { ...mockWorkoutLog, workoutDate: normalizedDate, ...updateDto };
      
      (workoutLogModel as any).findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWorkoutLog),
      });
      (workoutLogModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedLog),
      });

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);

      const result = await service.updateWorkoutLog(mockLogId, updateDto, mockUserId);

      // Verify that workoutDate was normalized in the update
      const updateCall = (workoutLogModel as any).findByIdAndUpdate.mock.calls[0][1];
      expect(updateCall.$set.workoutDate).toEqual(normalizedDate);
      // Note: The result may not be normalized if findByIdAndUpdate doesn't trigger pre-save hook
      // But the update call itself should have normalized date
      expect(updateCall.$set.workoutDate.getUTCHours()).toBe(0);
      expect(updateCall.$set.workoutDate.getUTCMinutes()).toBe(0);
    });

    it('should handle unique index violation by merging duplicates', async () => {
      // Use a valid date within last 30 days
      const validDate = getValidWorkoutDate(7);
      const updateDto: UpdateWorkoutLogDto = {
        workoutDate: validDate,
        isCompleted: true,
      };

      const normalizedDate = new Date(validDate);
      normalizedDate.setUTCHours(0, 0, 0, 0);
      
      const existingLogForMerge = {
        ...mockWorkoutLog,
        _id: new Types.ObjectId('507f1f77bcf86cd799439015'),
        workoutDate: normalizedDate,
      };
      
      // Define existingLog data first, then create the object with save mock
      const existingLogData = {
        ...mockWorkoutLog,
        _id: new Types.ObjectId('507f1f77bcf86cd799439016'),
        workoutDate: normalizedDate,
        isCompleted: false,
      };
      
      const existingLog = {
        ...existingLogData,
        save: jest.fn().mockResolvedValue({ ...existingLogData, ...updateDto }),
      };

      (workoutLogModel as any).findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingLogForMerge),
      });
      (workoutLogModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue({ code: 11000 }), // Unique index violation
      });
      (workoutLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingLog),
      });
      (workoutLogModel as any).findByIdAndDelete = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);

      const result = await service.updateWorkoutLog(mockLogId, updateDto, mockUserId);

      // Verify that merge logic was executed
      expect((workoutLogModel as any).findOne).toHaveBeenCalled();
      expect(existingLog.save).toHaveBeenCalled();
      expect(result.isCompleted).toBe(true);
    });

    it('should handle database error during update', async () => {
      const updateDto: UpdateWorkoutLogDto = {
        isCompleted: true,
      };

      (workoutLogModel as any).findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWorkoutLog),
      });
      (workoutLogModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);

      await expect(
        service.updateWorkoutLog(mockLogId, updateDto, mockUserId),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getTodayWorkout', () => {
    it('should return today workout', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (workoutLogModel as any).findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockWorkoutLog),
      });

      const result = await service.getTodayWorkout(mockClientId);

      expect((workoutLogModel as any).findOne).toHaveBeenCalled();
      expect(result).toEqual(mockWorkoutLog);
    });

    it('should return null if no workout today', async () => {
      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (workoutLogModel as any).findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getTodayWorkout(mockClientId);

      expect(result).toBeNull();
    });
  });

  describe('getWeekWorkouts', () => {
    it('should return workouts for a week', async () => {
      const date = new Date('2024-01-01');
      const mockLogs = [mockWorkoutLog];

      const clientsService = module.get<ClientsService>(ClientsService);
      const plansService = module.get<PlansService>(PlansService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (plansService.getPlanById as jest.Mock).mockResolvedValue(mockPlan as any);
      
      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockLogs),
      });

      const result = await service.getWeekWorkouts(mockClientId, date);

      expect((workoutLogModel as any).find).toHaveBeenCalled();
      // Service enriches logs with plan details
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...mockLogs[0],
        workoutName: expect.any(String),
        isRestDay: expect.any(Boolean),
        planExercises: expect.any(Array),
        planName: expect.any(String),
      });
    });

    it('should return empty array if no workouts found for week', async () => {
      const date = new Date('2024-01-01');

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      
      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getWeekWorkouts(mockClientId, date);

      expect(result).toEqual([]);
    });

    it('should handle enrichment error gracefully', async () => {
      const date = new Date('2024-01-01');
      const mockLogs = [mockWorkoutLog];

      const clientsService = module.get<ClientsService>(ClientsService);
      const plansService = module.get<PlansService>(PlansService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (plansService.getPlanById as jest.Mock).mockRejectedValue(new Error('Plan not found'));
      
      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockLogs),
      });

      // Service should still return logs even if enrichment fails
      const result = await service.getWeekWorkouts(mockClientId, date);

      expect(result).toHaveLength(1);
    });
  });

  describe('getWorkoutById', () => {
    it('should return workout log by id', async () => {
      (workoutLogModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutLog),
        }),
      });

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);

      const result = await service.getWorkoutById(mockLogId, mockUserId);

      expect((workoutLogModel as any).findById).toHaveBeenCalledWith(mockLogId);
      expect(clientsService.getProfile).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockWorkoutLog);
    });

    it('should throw NotFoundException if log not found', async () => {
      (workoutLogModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getWorkoutById(mockLogId, mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if workout does not belong to user', async () => {
      const otherClientId = '507f1f77bcf86cd799439020';
      const otherUserId = '507f1f77bcf86cd799439021';
      const otherClientProfile: Partial<ClientProfile> = {
        _id: new Types.ObjectId(otherClientId),
        userId: new Types.ObjectId(otherUserId),
      };

      // Log belongs to mockClientId, but user is otherUserId
      (workoutLogModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutLog),
        }),
      });

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(otherClientProfile as any);

      await expect(service.getWorkoutById(mockLogId, otherUserId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getWorkoutHistory', () => {
    it('should return completed workouts', async () => {
      const mockLogs = [{ ...mockWorkoutLog, isCompleted: true }];

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockLogs),
      });

      const result = await service.getWorkoutHistory(mockClientId);

      expect((workoutLogModel as any).find).toHaveBeenCalledWith({
        clientId: new Types.ObjectId((mockClientProfile as any)._id),
        isCompleted: true,
      });
      expect(result).toEqual(mockLogs);
    });
  });

  describe('markMissedWorkouts', () => {
    it('should mark overdue workouts as missed', async () => {
      // Service first calls find(...).exec() to get missed workouts
      const mockMissedWorkouts = [{ ...mockWorkoutLog, isCompleted: false, isMissed: false }];
      (workoutLogModel as any).find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMissedWorkouts),
      });
      
      (workoutLogModel as any).updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 5 }),
      });

      const gamificationService = module.get<GamificationService>(GamificationService);
      (gamificationService.addPenaltyToBalance as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      const result = await service.markMissedWorkouts();

      expect((workoutLogModel as any).updateMany).toHaveBeenCalledWith(
        {
          workoutDate: { $lt: expect.any(Date) },
          isCompleted: false,
          isMissed: false,
        },
        {
          $set: { isMissed: true },
        },
      );
      expect(result).toBe(5);
    });

    it('should add penalty for each missed workout', async () => {
      const mockMissedWorkouts = [
        { ...mockWorkoutLog, clientId: new Types.ObjectId(mockClientId), weeklyPlanId: new Types.ObjectId(mockPlanId), isCompleted: false, isMissed: false },
        { ...mockWorkoutLog, clientId: new Types.ObjectId(mockClientId), weeklyPlanId: new Types.ObjectId(mockPlanId), isCompleted: false, isMissed: false },
      ];
      (workoutLogModel as any).find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMissedWorkouts),
      });
      
      (workoutLogModel as any).updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
      });

      const gamificationService = module.get<GamificationService>(GamificationService);
      (gamificationService.addPenaltyToBalance as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      await service.markMissedWorkouts();

      // Should add penalty twice (once per missed workout)
      expect(gamificationService.addPenaltyToBalance).toHaveBeenCalledTimes(2);
      expect(gamificationService.addPenaltyToBalance).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
        1,
        'Missed workout',
        expect.any(Types.ObjectId),
      );
    });

    it('should continue processing other clients if penalty addition fails', async () => {
      const client1Id = new Types.ObjectId('507f1f77bcf86cd799439020');
      const client2Id = new Types.ObjectId('507f1f77bcf86cd799439021');
      const mockMissedWorkouts = [
        { ...mockWorkoutLog, clientId: client1Id, weeklyPlanId: new Types.ObjectId(mockPlanId), isCompleted: false, isMissed: false },
        { ...mockWorkoutLog, clientId: client2Id, weeklyPlanId: new Types.ObjectId(mockPlanId), isCompleted: false, isMissed: false },
      ];
      (workoutLogModel as any).find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMissedWorkouts),
      });
      
      (workoutLogModel as any).updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
      });

      const gamificationService = module.get<GamificationService>(GamificationService);
      (gamificationService.addPenaltyToBalance as jest.Mock) = jest.fn()
        .mockRejectedValueOnce(new Error('GamificationService error'))
        .mockResolvedValueOnce(undefined);

      // Should not throw, should continue processing
      const result = await service.markMissedWorkouts();

      expect(result).toBe(2);
      expect(gamificationService.addPenaltyToBalance).toHaveBeenCalledTimes(2);
    });

    it('should return 0 if no missed workouts found', async () => {
      (workoutLogModel as any).find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.markMissedWorkouts();

      expect(result).toBe(0);
      expect((workoutLogModel as any).updateMany).not.toHaveBeenCalled();
    });
  });

  describe('markMissedWorkoutsForPlan', () => {
    it('should mark missed workouts for a plan', async () => {
      const endDate = new Date('2024-01-31');
      (workoutLogModel as any).updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
      });

      await service.markMissedWorkoutsForPlan(mockClientId, mockPlanId, endDate);

      expect((workoutLogModel as any).updateMany).toHaveBeenCalledWith(
        {
          clientId: new Types.ObjectId(mockClientId),
          weeklyPlanId: new Types.ObjectId(mockPlanId),
          workoutDate: { $gte: expect.any(Date) },
          isCompleted: false,
          isMissed: false,
        },
        {
          $set: {
            isMissed: true,
            updatedAt: expect.any(Date),
          },
        },
      );
    });

    it('should handle error during markMissedWorkoutsForPlan', async () => {
      const endDate = new Date('2024-01-31');
      (workoutLogModel as any).updateMany.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(
        service.markMissedWorkoutsForPlan(mockClientId, mockPlanId, endDate),
      ).rejects.toThrow('Database error');
    });
  });

  describe('deleteUncompletedWorkoutsForPlan', () => {
    it('should delete uncompleted workouts for a plan', async () => {
      (workoutLogModel as any).countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });
      (workoutLogModel as any).deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 5 }),
      });

      const result = await service.deleteUncompletedWorkoutsForPlan(mockClientId, mockPlanId);

      expect((workoutLogModel as any).deleteMany).toHaveBeenCalledWith({
        clientId: new Types.ObjectId(mockClientId),
        weeklyPlanId: new Types.ObjectId(mockPlanId),
        isCompleted: false,
        isMissed: false,
      });
      expect(result).toBe(5);
    });

    it('should handle error during deleteUncompletedWorkoutsForPlan', async () => {
      (workoutLogModel as any).countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });
      (workoutLogModel as any).deleteMany.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(
        service.deleteUncompletedWorkoutsForPlan(mockClientId, mockPlanId),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getClientAnalytics', () => {
    it('should return analytics data with correct structure', async () => {
      // Mock workout logs - mix of completed and incomplete
      const mockWorkoutLogs = [
        {
          _id: new Types.ObjectId(),
          clientId: new Types.ObjectId(mockClientId),
          workoutDate: getValidWorkoutDate(5), // 5 days ago
          isCompleted: true,
          completedExercises: [
            {
              exerciseName: 'Bench Press',
              weightUsed: 80,
            },
          ],
        },
        {
          _id: new Types.ObjectId(),
          clientId: new Types.ObjectId(mockClientId),
          workoutDate: getValidWorkoutDate(3), // 3 days ago
          isCompleted: true,
          completedExercises: [
            {
              exerciseName: 'Squat',
              weightUsed: 100,
            },
          ],
        },
        {
          _id: new Types.ObjectId(),
          clientId: new Types.ObjectId(mockClientId),
          workoutDate: getValidWorkoutDate(2), // 2 days ago
          isCompleted: false,
          completedExercises: [],
        },
      ];

      // Mock getAllWorkoutLogsEnriched (which calls getWorkoutLogsByClient)
      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockWorkoutLogs),
      });

      // Mock ClientsService.getProfileById (used by getAllWorkoutLogsEnriched)
      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfileById as jest.Mock).mockResolvedValue(mockClientProfile);

      // Mock PlansService.getPlanById (used by getAllWorkoutLogsEnriched)
      const plansService = module.get<PlansService>(PlansService);
      (plansService.getPlanById as jest.Mock).mockResolvedValue(mockPlan);

      const result = await service.getClientAnalytics(mockClientId);

      // Verify structure
      expect(result).toHaveProperty('totalWorkouts');
      expect(result).toHaveProperty('completedWorkouts');
      expect(result).toHaveProperty('overallAdherence');
      expect(result).toHaveProperty('weeklyAdherence');
      expect(result).toHaveProperty('strengthProgression');

      // Verify basic metrics
      expect(result.totalWorkouts).toBe(3);
      expect(result.completedWorkouts).toBe(2);
      expect(result.overallAdherence).toBe(66.67); // 2/3 * 100 = 66.67%

      // Verify weeklyAdherence is array of 7 numbers
      expect(Array.isArray(result.weeklyAdherence)).toBe(true);
      expect(result.weeklyAdherence.length).toBe(7);

      // Verify strengthProgression is object with exercise names
      expect(typeof result.strengthProgression).toBe('object');
    });

    it('should return 0% adherence when no workouts exist', async () => {
      // Mock empty workout logs
      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getClientAnalytics(mockClientId);

      expect(result.totalWorkouts).toBe(0);
      expect(result.completedWorkouts).toBe(0);
      expect(result.overallAdherence).toBe(0);
      expect(result.weeklyAdherence).toEqual([0, 0, 0, 0, 0, 0, 0]);
      expect(Object.keys(result.strengthProgression).length).toBe(0);
    });

    it('should calculate weekly adherence correctly', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create workout logs for last 7 days (3 completed, 4 incomplete)
      const mockWorkoutLogs = [];
      for (let i = 0; i < 7; i++) {
        const workoutDate = new Date(today);
        workoutDate.setDate(today.getDate() - (6 - i)); // Day 0 = 6 days ago, Day 6 = today
        mockWorkoutLogs.push({
          _id: new Types.ObjectId(),
          clientId: new Types.ObjectId(mockClientId),
          workoutDate,
          isCompleted: i < 3, // First 3 days completed
          completedExercises: i < 3 ? [{ exerciseName: 'Test', weightUsed: 50 }] : [],
        });
      }

      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockWorkoutLogs),
      });

      // Mock ClientsService.getProfileById
      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfileById as jest.Mock).mockResolvedValue(mockClientProfile);

      // Mock PlansService.getPlanById
      const plansService = module.get<PlansService>(PlansService);
      (plansService.getPlanById as jest.Mock).mockResolvedValue(mockPlan);

      const result = await service.getClientAnalytics(mockClientId);

      // Verify weekly adherence array has 7 elements
      expect(result.weeklyAdherence.length).toBe(7);
      
      // First 3 days should have 100% adherence (1 completed / 1 total)
      expect(result.weeklyAdherence[0]).toBe(100);
      expect(result.weeklyAdherence[1]).toBe(100);
      expect(result.weeklyAdherence[2]).toBe(100);
      
      // Last 4 days should have 0% adherence (0 completed / 1 total)
      expect(result.weeklyAdherence[3]).toBe(0);
      expect(result.weeklyAdherence[4]).toBe(0);
      expect(result.weeklyAdherence[5]).toBe(0);
      expect(result.weeklyAdherence[6]).toBe(0);
    });

    it('should calculate strength progression correctly', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create workout logs with strength progression over last 30 days
      const mockWorkoutLogs = [];
      for (let i = 0; i < 5; i++) {
        const workoutDate = new Date(today);
        workoutDate.setDate(today.getDate() - (10 - i * 2)); // Spread over 10 days
        mockWorkoutLogs.push({
          _id: new Types.ObjectId(),
          clientId: new Types.ObjectId(mockClientId),
          workoutDate,
          isCompleted: true,
          completedExercises: [
            {
              exerciseName: 'Bench Press',
              weightUsed: 70 + i * 5, // Progressive weight: 70, 75, 80, 85, 90
            },
          ],
        });
      }

      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockWorkoutLogs),
      });

      // Mock ClientsService.getProfileById
      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfileById as jest.Mock).mockResolvedValue(mockClientProfile);

      // Mock PlansService.getPlanById
      const plansService = module.get<PlansService>(PlansService);
      (plansService.getPlanById as jest.Mock).mockResolvedValue(mockPlan);

      const result = await service.getClientAnalytics(mockClientId);

      // Verify strength progression has Bench Press data
      expect(result.strengthProgression).toHaveProperty('Bench Press');
      expect(Array.isArray(result.strengthProgression['Bench Press'])).toBe(true);
      
      // Verify progression data has x (day index) and y (weight) properties
      const benchPressData = result.strengthProgression['Bench Press'];
      if (benchPressData.length > 0) {
        expect(benchPressData[0]).toHaveProperty('x');
        expect(benchPressData[0]).toHaveProperty('y');
      }
    });

    it('should handle error and rethrow', async () => {
      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(service.getClientAnalytics(mockClientId)).rejects.toThrow('Database error');
    });
  });
});

