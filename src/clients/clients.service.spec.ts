import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { ClientsService } from './clients.service';
import { PlansService } from '../plans/plans.service';
import { ClientProfile, ClientProfileDocument } from './schemas/client-profile.schema';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Types } from 'mongoose';

describe('ClientsService', () => {
  let service: ClientsService;
  let model: Model<ClientProfileDocument>;
  let plansService: jest.Mocked<PlansService>;

  const mockClientProfile: Partial<ClientProfileDocument> = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    trainerId: new Types.ObjectId('507f1f77bcf86cd799439012'),
    age: 30,
    weight: 75.5,
    height: 175,
    totalWorkoutsCompleted: 10,
    currentStreak: 5,
    isPenaltyMode: false,
    consecutiveMissedWorkouts: 0,
    currentPlanId: new Types.ObjectId('507f1f77bcf86cd799439013'),
  };

  const mockModel = jest.fn().mockImplementation((data) => {
    return {
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, ...mockClientProfile }),
    };
  }) as any;

  mockModel.findOne = jest.fn();
  mockModel.findOneAndUpdate = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: getModelToken(ClientProfile.name),
          useValue: mockModel,
        },
        {
          provide: PlansService,
          useValue: {
            getPlanById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    model = module.get<Model<ClientProfileDocument>>(getModelToken(ClientProfile.name));
    plansService = module.get(PlansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProfile', () => {
    it('should create a client profile', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const trainerId = '507f1f77bcf86cd799439012';
      const dto: CreateClientDto = {
        age: 30,
        weight: 75.5,
      };

      const result = await service.createProfile(userId, trainerId, dto);

      expect(mockModel).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getProfile', () => {
    it('should return client profile by userId', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getProfile(userId);

      expect(mockModel.findOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
      });
      expect(mockQuery.populate).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockClientProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      await expect(service.getProfile(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update client profile', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateClientDto = {
        age: 31,
        weight: 76.0,
      };

      const updatedProfile = { ...mockClientProfile, ...dto };
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(updatedProfile),
      };

      mockModel.findOneAndUpdate.mockReturnValue(mockQuery);

      const result = await service.updateProfile(userId, dto);

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(userId) },
        { $set: dto },
        { new: true },
      );
      expect(result).toEqual(updatedProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateClientDto = { age: 31 };
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(null),
      };

      mockModel.findOneAndUpdate.mockReturnValue(mockQuery);

      await expect(service.updateProfile(userId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCurrentPlan', () => {
    it('should return current plan if exists', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockPlan = {
        _id: mockClientProfile.currentPlanId,
        name: 'Test Plan',
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      };

      mockModel.findOne.mockReturnValue(mockQuery);
      plansService.getPlanById.mockResolvedValue(mockPlan as any);

      const result = await service.getCurrentPlan(userId);

      expect(result).toEqual(mockPlan);
      expect(plansService.getPlanById).toHaveBeenCalled();
    });

    it('should return null if no plan assigned', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const profileWithoutPlan = { ...mockClientProfile, currentPlanId: null };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(profileWithoutPlan),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getCurrentPlan(userId);

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return client statistics', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getStats(userId);

      expect(result).toEqual({
        totalWorkoutsCompleted: mockClientProfile.totalWorkoutsCompleted,
        currentStreak: mockClientProfile.currentStreak,
        isPenaltyMode: mockClientProfile.isPenaltyMode,
        consecutiveMissedWorkouts: mockClientProfile.consecutiveMissedWorkouts,
      });
    });
  });
});

