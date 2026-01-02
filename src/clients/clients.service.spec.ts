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
    currentPlanId: new Types.ObjectId('507f1f77bcf86cd799439013'), // DB stores as ObjectId, service converts to string
  };

  const mockModel = jest.fn().mockImplementation((data) => {
    return {
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, ...mockClientProfile }),
    };
  }) as any;

  mockModel.findOne = jest.fn();
  mockModel.findOneAndUpdate = jest.fn();
  mockModel.updateOne = jest.fn();
  mockModel.findById = jest.fn();

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

    // Setup updateOne mock with exec chain
    mockModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
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

    it('should throw Error if userId format is invalid', async () => {
      const invalidUserId = 'invalid-id';
      const trainerId = '507f1f77bcf86cd799439012';
      const dto: CreateClientDto = {
        age: 30,
        weight: 75.5,
      };

      // MongoDB ObjectId constructor will throw if invalid
      await expect(
        service.createProfile(invalidUserId, trainerId, dto),
      ).rejects.toThrow();
    });

    it('should handle database error during createProfile', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const trainerId = '507f1f77bcf86cd799439012';
      const dto: CreateClientDto = {
        age: 30,
        weight: 75.5,
      };

      const mockInstance = {
        save: jest.fn().mockRejectedValue(new Error('Database error')),
      };
      (mockModel as jest.Mock).mockReturnValue(mockInstance);

      await expect(
        service.createProfile(userId, trainerId, dto),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getProfile', () => {
    it('should return client profile by userId', async () => {
      const userId = '507f1f77bcf86cd799439011';
      // Service calls profile.toObject(), so mock must have toObject method
      const mockProfileWithToObject = {
        ...mockClientProfile,
        toObject: jest.fn().mockReturnValue(mockClientProfile),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getProfile(userId);

      expect(mockModel.findOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
      });
      expect(mockQuery.populate).toHaveBeenCalledTimes(3);
      expect(mockProfileWithToObject.toObject).toHaveBeenCalled();
      // Service converts currentPlanId to string via extractObjectIdAsString
      expect(result).toMatchObject({
        ...mockClientProfile,
        currentPlanId: '507f1f77bcf86cd799439013',
      });
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

    it('should handle database error during getProfile', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      await expect(service.getProfile(userId)).rejects.toThrow('Database error');
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

    it('should handle partial update (only some fields)', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateClientDto = {
        age: 32,
      };

      const updatedProfile = { ...mockClientProfile, age: 32 };
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(updatedProfile),
      };

      mockModel.findOneAndUpdate.mockReturnValue(mockQuery);

      const result = await service.updateProfile(userId, dto);

      expect(result.age).toBe(32);
      expect(result.weight).toBe(mockClientProfile.weight); // Unchanged
    });

    it('should handle database error during updateProfile', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateClientDto = {
        age: 31,
      };

      const mockQuery = {
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockModel.findOneAndUpdate.mockReturnValue(mockQuery);

      await expect(service.updateProfile(userId, dto)).rejects.toThrow('Database error');
    });
  });

  describe('getCurrentPlan', () => {
    it('should return current plan if exists', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockPlan = {
        _id: mockClientProfile.currentPlanId,
        name: 'Test Plan',
      };
      // Service calls profile.toObject(), so mock must have toObject method
      // Profile needs planHistory with the plan entry to avoid updateOne call
      const profileWithHistory = {
        ...mockClientProfile,
        planHistory: [
          {
            planId: mockClientProfile.currentPlanId,
            planStartDate: new Date(),
            planEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            assignedAt: new Date(),
            trainerId: mockClientProfile.trainerId,
          },
        ],
      };
      const mockProfileWithToObject = {
        ...profileWithHistory,
        toObject: jest.fn().mockReturnValue(profileWithHistory),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
      };

      mockModel.findOne.mockReturnValue(mockQuery);
      plansService.getPlanById.mockResolvedValue(mockPlan as any);

      const result = await service.getCurrentPlan(userId);

      // Service returns plan with additional properties like isCurrent: true
      expect(result).toMatchObject(mockPlan);
      expect(plansService.getPlanById).toHaveBeenCalled();
    });

    it('should return null if no plan assigned', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const profileWithoutPlan = { ...mockClientProfile, currentPlanId: null };
      // Service calls profile.toObject(), so mock must have toObject method
      const mockProfileWithToObject = {
        ...profileWithoutPlan,
        toObject: jest.fn().mockReturnValue(profileWithoutPlan),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getCurrentPlan(userId);

      expect(result).toBeNull();
    });

    it('should handle plan with populated trainerId', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockPlan = {
        _id: mockClientProfile.currentPlanId,
        name: 'Test Plan',
        trainerId: { _id: mockClientProfile.trainerId, businessName: 'Test Trainer' },
      };
      const profileWithHistory = {
        ...mockClientProfile,
        planHistory: [
          {
            planId: mockClientProfile.currentPlanId,
            planStartDate: new Date(),
            planEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            assignedAt: new Date(),
            trainerId: mockClientProfile.trainerId,
          },
        ],
      };
      const mockProfileWithToObject = {
        ...profileWithHistory,
        toObject: jest.fn().mockReturnValue(profileWithHistory),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
      };

      mockModel.findOne.mockReturnValue(mockQuery);
      plansService.getPlanById.mockResolvedValue(mockPlan as any);

      const result = await service.getCurrentPlan(userId);

      expect(result).toBeDefined();
      expect(plansService.getPlanById).toHaveBeenCalled();
    });

    it('should handle error when PlansService fails', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const profileWithHistory = {
        ...mockClientProfile,
        planHistory: [
          {
            planId: mockClientProfile.currentPlanId,
            planStartDate: new Date(),
            planEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            assignedAt: new Date(),
            trainerId: mockClientProfile.trainerId,
          },
        ],
      };
      const mockProfileWithToObject = {
        ...profileWithHistory,
        toObject: jest.fn().mockReturnValue(profileWithHistory),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
      };

      mockModel.findOne.mockReturnValue(mockQuery);
      plansService.getPlanById.mockRejectedValue(new Error('Plan service error'));

      // Service should propagate error from PlansService
      await expect(service.getCurrentPlan(userId)).rejects.toThrow('Plan service error');
    });
  });

  describe('getStats', () => {
    it('should return client statistics', async () => {
      const userId = '507f1f77bcf86cd799439011';
      // Service calls profile.toObject(), so mock must have toObject method
      const mockProfileWithToObject = {
        ...mockClientProfile,
        toObject: jest.fn().mockReturnValue(mockClientProfile),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
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

    it('should return stats even if profile has no plan data', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const profileWithoutPlan = {
        ...mockClientProfile,
        currentPlanId: null,
        planHistory: [],
      };
      const mockProfileWithToObject = {
        ...profileWithoutPlan,
        toObject: jest.fn().mockReturnValue(profileWithoutPlan),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getStats(userId);

      expect(result).toBeDefined();
      expect(result.totalWorkoutsCompleted).toBeDefined();
    });

    it('should handle error when getProfile fails', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      await expect(service.getStats(userId)).rejects.toThrow('Database error');
    });
  });

  describe('getProfileById', () => {
    it('should return client profile by profileId', async () => {
      const profileId = mockClientProfile._id.toString();
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      };

      mockModel.findById = jest.fn().mockReturnValue(mockQuery);

      const result = await service.getProfileById(profileId);

      expect(mockModel.findById).toHaveBeenCalledWith(profileId);
      expect(mockQuery.populate).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockClientProfile);
    });

    it('should accept ObjectId as parameter', async () => {
      const profileId = mockClientProfile._id;
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      };

      mockModel.findById = jest.fn().mockReturnValue(mockQuery);

      const result = await service.getProfileById(profileId);

      expect(mockModel.findById).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(mockClientProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const profileId = new Types.ObjectId().toString();
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockModel.findById = jest.fn().mockReturnValue(mockQuery);

      await expect(service.getProfileById(profileId)).rejects.toThrow(NotFoundException);
      await expect(service.getProfileById(profileId)).rejects.toThrow('Client profile not found');
    });
  });

  describe('hasPlanInHistory', () => {
    it('should return true if plan exists in history', async () => {
      const clientProfileId = mockClientProfile._id.toString();
      const planId = mockClientProfile.currentPlanId.toString();
      
      const profileWithHistory = {
        ...mockClientProfile,
        planHistory: [
          {
            planId: mockClientProfile.currentPlanId,
            planStartDate: new Date(),
            planEndDate: new Date(),
            assignedAt: new Date(),
            trainerId: mockClientProfile.trainerId,
          },
        ],
      };

      mockModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(profileWithHistory),
      });

      const result = await service.hasPlanInHistory(clientProfileId, planId);

      expect(result).toBe(true);
    });

    it('should return false if plan does not exist in history', async () => {
      const clientProfileId = mockClientProfile._id.toString();
      const planId = new Types.ObjectId().toString();
      
      const profileWithHistory = {
        ...mockClientProfile,
        planHistory: [
          {
            planId: mockClientProfile.currentPlanId,
            planStartDate: new Date(),
            planEndDate: new Date(),
            assignedAt: new Date(),
            trainerId: mockClientProfile.trainerId,
          },
        ],
      };

      mockModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(profileWithHistory),
      });

      const result = await service.hasPlanInHistory(clientProfileId, planId);

      expect(result).toBe(false);
    });

    it('should return false if profile has no planHistory', async () => {
      const clientProfileId = mockClientProfile._id.toString();
      const planId = new Types.ObjectId().toString();
      
      const profileWithoutHistory = {
        ...mockClientProfile,
        planHistory: [],
      };

      // MERODAVNOST PROVERA: hasPlanInHistory poziva getProfileById koji koristi populate chain
      // Mock mora imati populate chain da bi test testirao stvarnu logiku
      mockModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(), // populate chain
        exec: jest.fn().mockResolvedValue(profileWithoutHistory),
      });

      const result = await service.hasPlanInHistory(clientProfileId, planId);

      expect(result).toBe(false);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const planId = new Types.ObjectId().toString();

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      mockModel.findById = jest.fn().mockReturnValue(mockQuery);

      await expect(service.hasPlanInHistory(clientProfileId, planId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPlanHistory', () => {
    it('should return plan history for client', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const planHistory = [
        {
          planId: mockClientProfile.currentPlanId,
          planStartDate: new Date('2025-01-01'),
          planEndDate: new Date('2025-01-07'),
          assignedAt: new Date('2025-01-01'),
          trainerId: mockClientProfile.trainerId,
        },
      ];
      
      const profileWithHistory = {
        ...mockClientProfile,
        planHistory,
      };
      
      const mockProfileWithToObject = {
        ...profileWithHistory,
        toObject: jest.fn().mockReturnValue(profileWithHistory),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      // MERODAVNOST PROVERA: getPlanHistory poziva plansService.getPlanById za svaki plan u history
      // Mock-ujemo da baca grešku (plan ne postoji), što je slučaj u stvarnoj logici
      plansService.getPlanById.mockRejectedValue(new NotFoundException('Plan not found'));

      const result = await service.getPlanHistory(userId);

      expect(mockModel.findOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
      });
      // MERODAVNOST PROVERA: getPlanHistory vraća objekat sa activePlan i planHistory
      // Svaki entry u planHistory ima isActive i planDetails (undefined ako plan ne postoji)
      expect(result).toHaveProperty('activePlan');
      expect(result).toHaveProperty('planHistory');
      expect(result.planHistory).toHaveLength(1);
      expect(result.planHistory[0]).toHaveProperty('isActive');
      expect(result.planHistory[0]).toHaveProperty('planDetails'); // undefined ako plan ne postoji
      // Osnovni podaci moraju biti prisutni
      expect(result.planHistory[0]).toHaveProperty('planId');
      expect(result.planHistory[0]).toHaveProperty('planStartDate');
      expect(result.planHistory[0]).toHaveProperty('planEndDate');
      expect(result.planHistory[0]).toHaveProperty('assignedAt');
      expect(result.planHistory[0]).toHaveProperty('trainerId');
    });

    it('should return empty array if no plan history', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const profileWithoutHistory = {
        ...mockClientProfile,
        planHistory: [],
      };
      
      const mockProfileWithToObject = {
        ...profileWithoutHistory,
        toObject: jest.fn().mockReturnValue(profileWithoutHistory),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getPlanHistory(userId);

      // MERODAVNOST PROVERA: getPlanHistory vraća objekat sa activePlan i planHistory
      expect(result).toHaveProperty('activePlan');
      expect(result).toHaveProperty('planHistory');
      expect(result.planHistory).toEqual([]);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      await expect(service.getPlanHistory(userId)).rejects.toThrow(NotFoundException);
    });

    it('should return history with multiple plans', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const planHistory = [
        {
          planId: mockClientProfile.currentPlanId,
          planStartDate: new Date('2025-01-01'),
          planEndDate: new Date('2025-01-07'),
          assignedAt: new Date('2025-01-01'),
          trainerId: mockClientProfile.trainerId,
        },
        {
          planId: new Types.ObjectId('507f1f77bcf86cd799439014'),
          planStartDate: new Date('2025-01-08'),
          planEndDate: new Date('2025-01-14'),
          assignedAt: new Date('2025-01-08'),
          trainerId: mockClientProfile.trainerId,
        },
      ];
      const profileWithHistory = {
        ...mockClientProfile,
        planHistory,
      };
      const mockProfileWithToObject = {
        ...profileWithHistory,
        toObject: jest.fn().mockReturnValue(profileWithHistory),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfileWithToObject),
      };

      mockModel.findOne.mockReturnValue(mockQuery);
      plansService.getPlanById.mockRejectedValue(new NotFoundException('Plan not found'));

      const result = await service.getPlanHistory(userId);

      expect(result.planHistory).toHaveLength(2);
      expect(plansService.getPlanById).toHaveBeenCalledTimes(2);
    });

    it('should handle error during getPlanHistory', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockModel.findOne.mockReturnValue(mockQuery);

      await expect(service.getPlanHistory(userId)).rejects.toThrow('Database error');
    });
  });

  describe('updateProfile edge cases', () => {
    it('should handle currentPlanId update', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const newPlanId = new Types.ObjectId().toString();
      const dto: UpdateClientDto = {
        currentPlanId: newPlanId,
      };

      const updatedProfile = { ...mockClientProfile, currentPlanId: new Types.ObjectId(newPlanId) };
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(updatedProfile),
      };

      mockModel.findOneAndUpdate.mockReturnValue(mockQuery);

      const result = await service.updateProfile(userId, dto);

      // MERODAVNOST PROVERA: currentPlanId should be converted to ObjectId
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(userId) },
        { $set: { currentPlanId: new Types.ObjectId(newPlanId) } },
        { new: true },
      );
      expect(result).toEqual(updatedProfile);
    });

    it('should handle planStartDate and planEndDate conversion', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-01-07T23:59:59.999Z';
      const dto: UpdateClientDto = {
        planStartDate: startDate,
        planEndDate: endDate,
      };

      const updatedProfile = {
        ...mockClientProfile,
        planStartDate: new Date(startDate),
        planEndDate: new Date(endDate),
      };
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(updatedProfile),
      };

      mockModel.findOneAndUpdate.mockReturnValue(mockQuery);

      const result = await service.updateProfile(userId, dto);

      // MERODAVNOST PROVERA: Dates should be converted to Date objects
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(userId) },
        {
          $set: {
            planStartDate: new Date(startDate),
            planEndDate: new Date(endDate),
          },
        },
        { new: true },
      );
      expect(result).toEqual(updatedProfile);
    });
  });
});

