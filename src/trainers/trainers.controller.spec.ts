import { Test, TestingModule } from '@nestjs/testing';
import { TrainersController } from './trainers.controller';
import { TrainersService } from './trainers.service';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { SubscriptionUpdateDto } from './dto/subscription-update.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Types } from 'mongoose';

describe('TrainersController', () => {
  let controller: TrainersController;
  let trainersService: jest.Mocked<TrainersService>;

  const mockTrainersService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getClients: jest.fn(),
    assignClientToTrainer: jest.fn(),
    removeClientFromTrainer: jest.fn(),
    getSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    upgradeSubscription: jest.fn(),
  };

  const mockTrainerProfile = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439020'),
    userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    businessName: 'FitZone',
    bio: 'Certified trainer',
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    subscriptionTier: 'BASIC',
    maxClients: 10,
  };

  const mockJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439011',
    email: 'trainer@test.com',
    role: 'TRAINER',
    iat: 1234567890,
    exp: 1234567890,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrainersController],
      providers: [
        {
          provide: TrainersService,
          useValue: mockTrainersService,
        },
      ],
    }).compile();

    controller = module.get<TrainersController>(TrainersController);
    trainersService = module.get(TrainersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return trainer profile', async () => {
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);

      const result = await controller.getProfile(mockJwtPayload);

      expect(trainersService.getProfile).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toEqual(mockTrainerProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      trainersService.getProfile.mockRejectedValue(new NotFoundException('Trainer profile not found'));

      await expect(controller.getProfile(mockJwtPayload)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateTrainerDto = {
      businessName: 'Updated FitZone',
      bio: 'Updated bio',
    };

    it('should update trainer profile', async () => {
      const updatedProfile = { ...mockTrainerProfile, ...updateDto };
      trainersService.updateProfile.mockResolvedValue(updatedProfile as any);

      const result = await controller.updateProfile(mockJwtPayload, updateDto);

      expect(trainersService.updateProfile).toHaveBeenCalledWith(mockJwtPayload.sub, updateDto);
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('getClients', () => {
    it('should return list of clients', async () => {
      const mockClients = [
        {
          _id: new Types.ObjectId(),
          userId: { email: 'client1@test.com' },
          trainerId: mockTrainerProfile._id,
        },
      ];
      trainersService.getClients.mockResolvedValue(mockClients as any);

      const result = await controller.getClients(mockJwtPayload);

      expect(trainersService.getClients).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toEqual(mockClients);
    });
  });

  describe('assignClient', () => {
    const clientId = '507f1f77bcf86cd799439021';

    it('should assign client to trainer', async () => {
      const result = {
        message: 'Client assigned successfully',
        clientId,
      };
      trainersService.assignClientToTrainer.mockResolvedValue(result);

      const response = await controller.assignClient(mockJwtPayload, clientId);

      expect(trainersService.assignClientToTrainer).toHaveBeenCalledWith(mockJwtPayload.sub, clientId);
      expect(response).toEqual(result);
    });

    it('should throw BadRequestException if max clients reached', async () => {
      trainersService.assignClientToTrainer.mockRejectedValue(
        new BadRequestException('Maximum number of clients reached'),
      );

      await expect(controller.assignClient(mockJwtPayload, clientId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeClient', () => {
    const clientId = '507f1f77bcf86cd799439021';

    it('should remove client from trainer', async () => {
      const result = {
        message: 'Client removed successfully',
        clientId,
      };
      trainersService.removeClientFromTrainer.mockResolvedValue(result);

      const response = await controller.removeClient(mockJwtPayload, clientId);

      expect(trainersService.removeClientFromTrainer).toHaveBeenCalledWith(mockJwtPayload.sub, clientId);
      expect(response).toEqual(result);
    });
  });

  describe('getSubscription', () => {
    it('should return subscription details', async () => {
      const profileWithSubscription = {
        ...mockTrainerProfile,
        subscriptionExpiresAt: new Date(),
        lastPaymentDate: new Date(),
      };
      trainersService.getProfile.mockResolvedValue(profileWithSubscription as any);

      const result = await controller.getSubscription(mockJwtPayload);

      expect(trainersService.getProfile).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toHaveProperty('subscriptionStatus');
      expect(result).toHaveProperty('subscriptionTier');
      expect(result).toHaveProperty('subscriptionExpiresAt');
      expect(result).toHaveProperty('isActive');
    });
  });

  describe('updateSubscription', () => {
    const updateDto: SubscriptionUpdateDto = {
      subscriptionStatus: SubscriptionStatus.SUSPENDED,
    };

    it('should update subscription', async () => {
      const updatedProfile = {
        ...mockTrainerProfile,
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
      };
      trainersService.updateSubscription.mockResolvedValue(updatedProfile as any);

      const result = await controller.updateSubscription(mockJwtPayload, updateDto);

      expect(trainersService.updateSubscription).toHaveBeenCalledWith(mockJwtPayload.sub, updateDto);
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('upgradeSubscription', () => {
    const upgradeDto: UpgradeSubscriptionDto = {
      newTier: 'PRO',
    };

    it('should upgrade subscription tier', async () => {
      const upgradedProfile = {
        ...mockTrainerProfile,
        subscriptionTier: 'PRO',
        maxClients: 50,
      };
      trainersService.upgradeSubscription.mockResolvedValue(upgradedProfile as any);

      const result = await controller.upgradeSubscription(mockJwtPayload, upgradeDto);

      expect(trainersService.upgradeSubscription).toHaveBeenCalledWith(mockJwtPayload.sub, upgradeDto);
      expect(result).toEqual(upgradedProfile);
    });

    it('should throw BadRequestException if trying to downgrade', async () => {
      trainersService.upgradeSubscription.mockRejectedValue(
        new BadRequestException('Cannot upgrade to BASIC. Current tier is PRO.'),
      );

      await expect(controller.upgradeSubscription(mockJwtPayload, upgradeDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
