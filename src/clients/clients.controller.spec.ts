import { Test, TestingModule } from '@nestjs/testing';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { TrainersService } from '../trainers/trainers.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Types } from 'mongoose';

describe('ClientsController', () => {
  let controller: ClientsController;
  let clientsService: jest.Mocked<ClientsService>;
  let workoutsService: jest.Mocked<WorkoutsService>;

  const mockClientsService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getCurrentPlan: jest.fn(),
    getStats: jest.fn(), 
  };

  const mockWorkoutsService = {
    getWeekWorkouts: jest.fn(),
    getWorkoutHistory: jest.fn(),
  };

  const mockTrainersService = {
    getProfileById: jest.fn(),
  };

  const mockClientProfile = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439021'),
    userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
    trainerId: new Types.ObjectId('507f1f77bcf86cd799439020'),
    weight: 75.5,
    height: 175,
    fitnessGoal: 'WEIGHT_LOSS',
    activityLevel: 'MODERATE',
    totalWorkoutsCompleted: 10,
    currentStreak: 5,
    isPenaltyMode: false,
    consecutiveMissedWorkouts: 0,
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
      controllers: [ClientsController],
      providers: [
        {
          provide: ClientsService,
          useValue: mockClientsService,
        },
        {
          provide: WorkoutsService,
          useValue: mockWorkoutsService,
        },
        {
          provide: TrainersService,
          useValue: mockTrainersService,
        },
      ],
    }).compile();

    controller = module.get<ClientsController>(ClientsController);
    clientsService = module.get(ClientsService);
    workoutsService = module.get(WorkoutsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return client profile', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);

      const result = await controller.getProfile(mockJwtPayload);

      expect(clientsService.getProfile).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toEqual(mockClientProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      clientsService.getProfile.mockRejectedValue(new NotFoundException('Client profile not found'));

      await expect(controller.getProfile(mockJwtPayload)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateClientDto = {
      weight: 76.0,
      height: 176,
      fitnessGoal: 'MUSCLE_GAIN',
      activityLevel: 'VERY_ACTIVE',
    };

    it('should update client profile', async () => {
      const updatedProfile = { ...mockClientProfile, ...updateDto };
      clientsService.updateProfile.mockResolvedValue(updatedProfile as any);

      const result = await controller.updateProfile(mockJwtPayload, updateDto);

      expect(clientsService.updateProfile).toHaveBeenCalledWith(mockJwtPayload.sub, updateDto);
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('getCurrentPlan', () => {
    it('should return current plan', async () => {
      const mockPlan = {
        _id: new Types.ObjectId('507f1f77bcf86cd799439030'),
        name: 'Week 1 Plan',
        difficulty: 'BEGINNER',
      };
      clientsService.getCurrentPlan.mockResolvedValue(mockPlan as any);

      const result = await controller.getCurrentPlan(mockJwtPayload);

      expect(clientsService.getCurrentPlan).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toEqual(mockPlan);
    });

    it('should return null if no plan assigned', async () => {
      clientsService.getCurrentPlan.mockResolvedValue(null);

      const result = await controller.getCurrentPlan(mockJwtPayload);

      expect(result).toBeNull();
    });
  });

  describe('getUpcomingWorkouts', () => {
    it('should return upcoming workouts for the week', async () => {
      const mockWorkouts = [
        {
          _id: new Types.ObjectId(),
          workoutDate: new Date(),
          isCompleted: false,
        },
      ];
      workoutsService.getWeekWorkouts.mockResolvedValue(mockWorkouts as any);

      const result = await controller.getUpcomingWorkouts(mockJwtPayload);

      expect(workoutsService.getWeekWorkouts).toHaveBeenCalled();
      expect(result).toEqual(mockWorkouts);
    });
  });

  describe('getWorkoutHistory', () => {
    it('should return workout history', async () => {
      const mockHistory = [
        {
          _id: new Types.ObjectId(),
          workoutDate: new Date(),
          isCompleted: true,
        },
      ];
      workoutsService.getWorkoutHistory.mockResolvedValue(mockHistory as any);

      const result = await controller.getWorkoutHistory(mockJwtPayload);

      expect(workoutsService.getWorkoutHistory).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getTrainer', () => {
    it('should return trainer ID', async () => {
      const profileWithTrainer = {
        ...mockClientProfile,
        trainerId: mockClientProfile.trainerId,
      };
      clientsService.getProfile.mockResolvedValue(profileWithTrainer as any);

      const result = await controller.getTrainer(mockJwtPayload);

      expect(clientsService.getProfile).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toHaveProperty('id');
    });

    it('should return null trainer ID if not assigned', async () => {
      const profileWithoutTrainer = {
        ...mockClientProfile,
        trainerId: null,
      };
      clientsService.getProfile.mockResolvedValue(profileWithoutTrainer as any);

      const result = await controller.getTrainer(mockJwtPayload);

      expect(result).toHaveProperty('id', null);
    });
  });

  describe('getStats', () => {
    it('should return client statistics', async () => {
      const mockStats = {
        totalWorkoutsCompleted: 10,
        currentStreak: 5,
        isPenaltyMode: false,
        consecutiveMissedWorkouts: 0,
      };
      clientsService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(mockJwtPayload);

      expect(clientsService.getStats).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toEqual(mockStats);
    });
  });
});
