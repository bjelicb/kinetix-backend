import { Test, TestingModule } from '@nestjs/testing';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';
import { NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Types } from 'mongoose';

describe('WorkoutsController', () => {
  let controller: WorkoutsController;
  let workoutsService: jest.Mocked<WorkoutsService>;

  const mockWorkoutsService = {
    logWorkout: jest.fn(),
    updateWorkoutLog: jest.fn(),
    getTodayWorkout: jest.fn(),
    getWorkoutById: jest.fn(),
    getWeekWorkouts: jest.fn(),
    getWorkoutHistory: jest.fn(),
  };

  const mockClientsService = {
    getProfile: jest.fn(),
  };

  const mockTrainersService = {
    getProfileById: jest.fn(),
  };

  const mockWorkoutLog = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439040'),
    clientId: new Types.ObjectId('507f1f77bcf86cd799439021'),
    workoutDate: new Date('2024-01-01'),
    isCompleted: true,
    completedExercises: [],
  };

  const mockJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439012',
    email: 'client@test.com',
    role: 'CLIENT',
    iat: 1234567890,
    exp: 1234567890,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkoutsController],
      providers: [
        {
          provide: WorkoutsService,
          useValue: mockWorkoutsService,
        },
        {
          provide: ClientsService,
          useValue: mockClientsService,
        },
        {
          provide: TrainersService,
          useValue: mockTrainersService,
        },
      ],
    }).compile();

    controller = module.get<WorkoutsController>(WorkoutsController);
    workoutsService = module.get(WorkoutsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logWorkout', () => {
    const logDto: LogWorkoutDto = {
      workoutDate: '2024-01-01T00:00:00.000Z',
      dayOfWeek: 1,
      weeklyPlanId: '507f1f77bcf86cd799439030',
      completedExercises: [],
      isCompleted: true,
    };

    it('should log a workout', async () => {
      workoutsService.logWorkout.mockResolvedValue(mockWorkoutLog as any);

      const result = await controller.logWorkout(mockJwtPayload, logDto);

      expect(workoutsService.logWorkout).toHaveBeenCalledWith(mockJwtPayload.sub, logDto);
      expect(result).toEqual(mockWorkoutLog);
    });
  });

  describe('updateWorkoutLog', () => {
    const logId = '507f1f77bcf86cd799439040';
    const updateDto: UpdateWorkoutLogDto = {
      isCompleted: true,
      completedExercises: [{ exerciseName: 'Squat', actualSets: 3, actualReps: [10, 10, 10] }],
    };

    it('should update workout log', async () => {
      const updatedLog = { ...mockWorkoutLog, ...updateDto };
      workoutsService.updateWorkoutLog.mockResolvedValue(updatedLog as any);

      const result = await controller.updateWorkoutLog(logId, updateDto);

      expect(workoutsService.updateWorkoutLog).toHaveBeenCalledWith(logId, updateDto);
      expect(result).toEqual(updatedLog);
    });

    it('should throw NotFoundException if log not found', async () => {
      workoutsService.updateWorkoutLog.mockRejectedValue(new NotFoundException('Workout log not found'));

      await expect(controller.updateWorkoutLog(logId, updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTodayWorkout', () => {
    it('should return today workout', async () => {
      workoutsService.getTodayWorkout.mockResolvedValue(mockWorkoutLog as any);

      const result = await controller.getTodayWorkout(mockJwtPayload);

      expect(workoutsService.getTodayWorkout).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toEqual(mockWorkoutLog);
    });

    it('should return null if no workout today', async () => {
      workoutsService.getTodayWorkout.mockResolvedValue(null);

      const result = await controller.getTodayWorkout(mockJwtPayload);

      expect(result).toBeNull();
    });
  });

  describe('getWorkoutById', () => {
    const logId = '507f1f77bcf86cd799439040';

    it('should return workout log by id', async () => {
      workoutsService.getWorkoutById.mockResolvedValue(mockWorkoutLog as any);

      const result = await controller.getWorkoutById(logId);

      expect(workoutsService.getWorkoutById).toHaveBeenCalledWith(logId);
      expect(result).toEqual(mockWorkoutLog);
    });

    it('should throw NotFoundException if log not found', async () => {
      workoutsService.getWorkoutById.mockRejectedValue(new NotFoundException('Workout log not found'));

      await expect(controller.getWorkoutById(logId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWeekWorkouts', () => {
    const date = '2024-01-01';

    it('should return workouts for a week', async () => {
      const mockLogs = [mockWorkoutLog];
      workoutsService.getWeekWorkouts.mockResolvedValue(mockLogs as any);

      const result = await controller.getWeekWorkouts(mockJwtPayload, date);

      expect(workoutsService.getWeekWorkouts).toHaveBeenCalledWith(
        mockJwtPayload.sub,
        expect.any(Date),
      );
      expect(result).toEqual(mockLogs);
    });
  });
});
