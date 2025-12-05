import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { WorkoutsService } from './workouts.service';
import { WorkoutLog, WorkoutLogDocument } from './schemas/workout-log.schema';
import { ClientProfile } from '../clients/schemas/client-profile.schema';
import { WeeklyPlan } from '../plans/schemas/weekly-plan.schema';
import { ClientsService } from '../clients/clients.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';

describe('WorkoutsService', () => {
  let service: WorkoutsService;
  let workoutLogModel: jest.Mocked<Model<WorkoutLogDocument>>;

  const mockClientId = '507f1f77bcf86cd799439011';
  const mockTrainerId = '507f1f77bcf86cd799439012';
  const mockPlanId = '507f1f77bcf86cd799439013';
  const mockLogId = '507f1f77bcf86cd799439014';

  const mockClientProfile: Partial<ClientProfile> = {
    _id: new Types.ObjectId(mockClientId),
    userId: new Types.ObjectId('507f1f77bcf86cd799439015'),
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
  });

  describe('logWorkout', () => {
    it('should create a new workout log', async () => {
      const logDto: LogWorkoutDto = {
        workoutDate: new Date('2024-01-01'),
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
        save: jest.fn().mockResolvedValue({ ...mockWorkoutLog, ...logDto }),
      };
      (workoutLogModel as any).mockImplementation(() => mockInstance);

      const result = await service.logWorkout(mockClientId, logDto);

      expect((workoutLogModel as any).findOne).toHaveBeenCalled();
      expect(mockInstance.save).toHaveBeenCalled();
      expect(result.isCompleted).toBe(true);
    });

    it('should update existing workout log', async () => {
      const logDto: LogWorkoutDto = {
        workoutDate: new Date('2024-01-01'),
        dayOfWeek: 1,
        weeklyPlanId: mockPlanId,
        completedExercises: [{ exerciseName: 'Squat', actualSets: 3, actualReps: [10, 10, 10] }],
        isCompleted: true,
      };

      const clientsService = module.get<ClientsService>(ClientsService);
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      const existingLog = {
        ...mockWorkoutLog,
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
  });

  describe('updateWorkoutLog', () => {
    it('should update workout log', async () => {
      const updateDto: UpdateWorkoutLogDto = {
        isCompleted: true,
        completedExercises: [{ exerciseName: 'Squat', actualSets: 3, actualReps: [10, 10, 10] }],
      };

      const updatedLog = { ...mockWorkoutLog, ...updateDto };
      (workoutLogModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedLog),
      });

      const result = await service.updateWorkoutLog(mockLogId, updateDto);

      expect((workoutLogModel as any).findByIdAndUpdate).toHaveBeenCalledWith(
        mockLogId,
        { $set: updateDto },
        { new: true },
      );
      expect(result.isCompleted).toBe(true);
    });

    it('should throw NotFoundException if log not found', async () => {
      (workoutLogModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateWorkoutLog(mockLogId, { isCompleted: true }),
      ).rejects.toThrow(NotFoundException);
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
      (clientsService.getProfile as jest.Mock).mockResolvedValue(mockClientProfile as any);
      (workoutLogModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockLogs),
      });

      const result = await service.getWeekWorkouts(mockClientId, date);

      expect((workoutLogModel as any).find).toHaveBeenCalled();
      expect(result).toEqual(mockLogs);
    });
  });

  describe('getWorkoutById', () => {
    it('should return workout log by id', async () => {
      (workoutLogModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutLog),
        }),
      });

      const result = await service.getWorkoutById(mockLogId);

      expect((workoutLogModel as any).findById).toHaveBeenCalledWith(mockLogId);
      expect(result).toEqual(mockWorkoutLog);
    });

    it('should throw NotFoundException if log not found', async () => {
      (workoutLogModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getWorkoutById(mockLogId)).rejects.toThrow(NotFoundException);
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
      (workoutLogModel as any).updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 5 }),
      });

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
  });
});

