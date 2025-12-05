import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Model } from 'mongoose';
import { TrainersService } from './trainers.service';
import { TrainerProfile, TrainerProfileDocument } from './schemas/trainer-profile.schema';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { SubscriptionUpdateDto } from './dto/subscription-update.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import { SubscriptionTier } from './dto/upgrade-subscription.dto';
import { Types } from 'mongoose';

describe('TrainersService', () => {
  let service: TrainersService;
  let trainerModel: Model<TrainerProfileDocument>;
  let clientModel: Model<ClientProfileDocument>;

  const mockTrainerProfile: Partial<TrainerProfileDocument> = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439020'),
    userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    isActive: true,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    subscriptionTier: 'BASIC',
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    businessName: 'FitZone',
    bio: 'Certified trainer',
    certifications: ['NASM-CPT'],
    specializations: ['Weight Loss'],
    yearsExperience: 5,
    clientIds: [],
    maxClients: 10,
    save: jest.fn().mockResolvedValue(this),
  };

  const mockClientProfile: Partial<ClientProfileDocument> = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439021'),
    userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
    trainerId: new Types.ObjectId('507f1f77bcf86cd799439020'),
  };

  const mockTrainerModel = jest.fn().mockImplementation((data) => {
    return {
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, ...mockTrainerProfile }),
    };
  }) as any;

  mockTrainerModel.findOne = jest.fn();
  mockTrainerModel.findOneAndUpdate = jest.fn();
  mockTrainerModel.findById = jest.fn();
  mockTrainerModel.findByIdAndUpdate = jest.fn();

  const mockClientModel = {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainersService,
        {
          provide: getModelToken(TrainerProfile.name),
          useValue: mockTrainerModel,
        },
        {
          provide: getModelToken(ClientProfile.name),
          useValue: mockClientModel,
        },
      ],
    }).compile();

    service = module.get<TrainersService>(TrainersService);
    trainerModel = module.get<Model<TrainerProfileDocument>>(getModelToken(TrainerProfile.name));
    clientModel = module.get<Model<ClientProfileDocument>>(getModelToken(ClientProfile.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProfile', () => {
    it('should create a trainer profile with default subscription', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: CreateTrainerDto = {
        businessName: 'FitZone',
        bio: 'Certified trainer',
      };

      const result = await service.createProfile(userId, dto);

      expect(mockTrainerModel).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should set subscriptionExpiresAt to 30 days from now', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: CreateTrainerDto = {};

      await service.createProfile(userId, dto);

      const callArgs = mockTrainerModel.mock.calls[0][0];
      expect(callArgs.subscriptionExpiresAt).toBeInstanceOf(Date);
      expect(callArgs.isActive).toBe(true);
    });
  });

  describe('getProfile', () => {
    it('should return trainer profile by userId', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);

      const result = await service.getProfile(userId);

      expect(mockTrainerModel.findOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
      });
      expect(mockQuery.populate).toHaveBeenCalledWith('userId', 'email firstName lastName');
      expect(result).toEqual(mockTrainerProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);

      await expect(service.getProfile(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update trainer profile', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateTrainerDto = {
        businessName: 'Updated FitZone',
        bio: 'Updated bio',
      };

      const updatedProfile = { ...mockTrainerProfile, ...dto };
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(updatedProfile),
      };

      mockTrainerModel.findOneAndUpdate.mockReturnValue(mockQuery);

      const result = await service.updateProfile(userId, dto);

      expect(mockTrainerModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(userId) },
        { $set: dto },
        { new: true },
      );
      expect(result).toEqual(updatedProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateTrainerDto = { businessName: 'Updated' };
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(null),
      };

      mockTrainerModel.findOneAndUpdate.mockReturnValue(mockQuery);

      await expect(service.updateProfile(userId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription status', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: SubscriptionUpdateDto = {
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
        subscriptionTier: 'PRO',
      };

      const updatedProfile = {
        ...mockTrainerProfile,
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
        subscriptionTier: 'PRO',
      };

      const mockQuery = {
        exec: jest.fn().mockResolvedValue(updatedProfile),
      };

      mockTrainerModel.findOneAndUpdate.mockReturnValue(mockQuery);

      const result = await service.updateSubscription(userId, dto);

      expect(mockTrainerModel.findOneAndUpdate).toHaveBeenCalled();
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.SUSPENDED);
      expect(result.subscriptionTier).toBe('PRO');
    });

    it('should update subscription expiration date', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const expiresAt = new Date('2025-12-31');
      const dto: SubscriptionUpdateDto = {
        subscriptionExpiresAt: expiresAt.toISOString(),
      };

      const updatedProfile = {
        ...mockTrainerProfile,
        subscriptionExpiresAt: expiresAt,
      };

      const mockQuery = {
        exec: jest.fn().mockResolvedValue(updatedProfile),
      };

      mockTrainerModel.findOneAndUpdate.mockReturnValue(mockQuery);

      const result = await service.updateSubscription(userId, dto);

      expect(mockTrainerModel.findOneAndUpdate).toHaveBeenCalled();
      expect(result.subscriptionExpiresAt).toEqual(expiresAt);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const dto: SubscriptionUpdateDto = {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      };

      const mockQuery = {
        exec: jest.fn().mockResolvedValue(null),
      };

      mockTrainerModel.findOneAndUpdate.mockReturnValue(mockQuery);

      await expect(service.updateSubscription(userId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfileById', () => {
    it('should return trainer profile by profileId', async () => {
      const profileId = '507f1f77bcf86cd799439020';
      mockTrainerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      });

      const result = await service.getProfileById(profileId);

      expect(mockTrainerModel.findById).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(mockTrainerProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const profileId = '507f1f77bcf86cd799439020';
      mockTrainerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getProfileById(profileId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getClients', () => {
    it('should return list of clients', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockClients = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd799439021'),
          userId: { email: 'client1@test.com' },
          trainerId: mockTrainerProfile._id,
          currentPlanId: null,
          fitnessGoal: 'WEIGHT_LOSS',
          activityLevel: 'MODERATE',
          totalWorkoutsCompleted: 10,
          currentStreak: 5,
          isPenaltyMode: false,
        },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockClientModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockClients),
      });

      const result = await service.getClients(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('_id');
    });
  });

  describe('assignClientToTrainer', () => {
    const userId = '507f1f77bcf86cd799439011';
    const clientProfileId = '507f1f77bcf86cd799439021';

    it('should assign client to trainer', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockClientModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });
      mockClientModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockClientProfile,
          trainerId: null,
        }),
      });
      mockClientModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      });
      mockTrainerModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      });

      const result = await service.assignClientToTrainer(userId, clientProfileId);

      expect(result).toHaveProperty('message', 'Client assigned successfully');
      expect(result).toHaveProperty('clientId', clientProfileId);
    });

    it('should throw BadRequestException if max clients reached', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockClientModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(10),
      });

      await expect(service.assignClientToTrainer(userId, clientProfileId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if client not found', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockClientModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });
      mockClientModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.assignClientToTrainer(userId, clientProfileId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return success if client already assigned to same trainer (idempotent)', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockClientModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });
      mockClientModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockClientProfile,
          trainerId: mockTrainerProfile._id,
        }),
      });

      const result = await service.assignClientToTrainer(userId, clientProfileId);

      expect(result).toHaveProperty('message', 'Client already assigned to this trainer');
    });

    it('should throw BadRequestException if client assigned to different trainer', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };
      const otherTrainerId = new Types.ObjectId('507f1f77bcf86cd799439022');

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockClientModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });
      mockClientModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockClientProfile,
          trainerId: otherTrainerId,
        }),
      });

      await expect(service.assignClientToTrainer(userId, clientProfileId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeClientFromTrainer', () => {
    const userId = '507f1f77bcf86cd799439011';
    const clientProfileId = '507f1f77bcf86cd799439021';

    it('should remove client from trainer', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockClientModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      });
      mockClientModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      });
      mockTrainerModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      });

      const result = await service.removeClientFromTrainer(userId, clientProfileId);

      expect(result).toHaveProperty('message', 'Client removed successfully');
      expect(result).toHaveProperty('clientId', clientProfileId);
    });

    it('should throw NotFoundException if client not found', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockClientModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.removeClientFromTrainer(userId, clientProfileId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if client does not belong to trainer', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };
      const otherTrainerId = new Types.ObjectId('507f1f77bcf86cd799439022');

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockClientModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockClientProfile,
          trainerId: otherTrainerId,
        }),
      });

      await expect(service.removeClientFromTrainer(userId, clientProfileId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('upgradeSubscription', () => {
    const userId = '507f1f77bcf86cd799439011';

    it('should upgrade subscription from BASIC to PRO', async () => {
      const dto: UpgradeSubscriptionDto = {
        newTier: SubscriptionTier.PRO,
      };
      const updatedProfile = {
        ...mockTrainerProfile,
        subscriptionTier: SubscriptionTier.PRO,
        maxClients: 50,
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);
      mockTrainerModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedProfile),
      });

      const result = await service.upgradeSubscription(userId, dto);

      expect(result.subscriptionTier).toBe('PRO');
      expect(result.maxClients).toBe(50);
    });

    it('should throw BadRequestException if trying to downgrade', async () => {
      const dto: UpgradeSubscriptionDto = {
        newTier: SubscriptionTier.BASIC,
      };
      const proProfile = {
        ...mockTrainerProfile,
        subscriptionTier: SubscriptionTier.PRO,
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(proProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);

      await expect(service.upgradeSubscription(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to upgrade to same tier', async () => {
      const dto: UpgradeSubscriptionDto = {
        newTier: SubscriptionTier.BASIC,
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);

      await expect(service.upgradeSubscription(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if profile not found', async () => {
      const dto: UpgradeSubscriptionDto = {
        newTier: SubscriptionTier.PRO,
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockTrainerModel.findOne.mockReturnValue(mockQuery);

      await expect(service.upgradeSubscription(userId, dto)).rejects.toThrow(NotFoundException);
    });
  });
});

