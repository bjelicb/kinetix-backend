import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SaasKillswitchGuard } from './saas-killswitch.guard';
import { ClientsService } from '../../clients/clients.service';
import { TrainersService } from '../../trainers/trainers.service';
import { TrainerProfile, TrainerProfileDocument } from '../../trainers/schemas/trainer-profile.schema';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { UserRole } from '../enums/user-role.enum';
import { Types } from 'mongoose';

describe('SaasKillswitchGuard', () => {
  let guard: SaasKillswitchGuard;
  let clientsService: jest.Mocked<ClientsService>;
  let trainersService: jest.Mocked<TrainersService>;
  let trainerModel: jest.Mocked<Model<TrainerProfileDocument>>;

  const mockClientProfile: Partial<ClientProfile> = {
    userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    trainerId: new Types.ObjectId('507f1f77bcf86cd799439012'),
  };

  const mockTrainerProfile: Partial<TrainerProfileDocument> = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    userId: new Types.ObjectId('507f1f77bcf86cd799439013'),
    isActive: true,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    save: jest.fn().mockResolvedValue(this),
  };

  const mockExecutionContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasKillswitchGuard,
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
        {
          provide: TrainersService,
          useValue: {
            getProfileById: jest.fn(),
            updateSubscription: jest.fn().mockResolvedValue(undefined),
            updateProfile: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getModelToken(TrainerProfile.name),
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<SaasKillswitchGuard>(SaasKillswitchGuard);
    clientsService = module.get(ClientsService);
    trainersService = module.get(TrainersService);
    trainerModel = module.get(getModelToken(TrainerProfile.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow TRAINER requests to bypass', async () => {
      const context = mockExecutionContext({
        sub: '507f1f77bcf86cd799439011',
        role: UserRole.TRAINER,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(clientsService.getProfile).not.toHaveBeenCalled();
    });

    it('should allow requests without user (bypass)', async () => {
      const context = mockExecutionContext(null);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(clientsService.getProfile).not.toHaveBeenCalled();
    });

    it('should allow CLIENT requests when subscription is active', async () => {
      const context = mockExecutionContext({
        sub: '507f1f77bcf86cd799439011',
        role: UserRole.CLIENT,
      });

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      trainersService.getProfileById.mockResolvedValue(mockTrainerProfile as any);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(clientsService.getProfile).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(trainersService.getProfileById).toHaveBeenCalled();
    });

    it('should block CLIENT requests when subscription is inactive', async () => {
      const context = mockExecutionContext({
        sub: '507f1f77bcf86cd799439011',
        role: UserRole.CLIENT,
      });

      const inactiveTrainer = {
        ...mockTrainerProfile,
        isActive: false,
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
      };

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      trainersService.getProfileById.mockResolvedValue(inactiveTrainer as any);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      expect(clientsService.getProfile).toHaveBeenCalled();
      expect(trainersService.getProfileById).toHaveBeenCalled();
    });

    it('should block CLIENT requests when subscription status is CANCELLED', async () => {
      const context = mockExecutionContext({
        sub: '507f1f77bcf86cd799439011',
        role: UserRole.CLIENT,
      });

      const cancelledTrainer = {
        ...mockTrainerProfile,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.CANCELLED,
      };

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      trainersService.getProfileById.mockResolvedValue(cancelledTrainer as any);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should block CLIENT requests when subscription has expired and auto-suspend', async () => {
      const context = mockExecutionContext({
        sub: '507f1f77bcf86cd799439011',
        role: UserRole.CLIENT,
      });

      const expiredTrainer = {
        ...mockTrainerProfile,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        userId: new Types.ObjectId('507f1f77bcf86cd799439013'),
      };

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      trainersService.getProfileById.mockResolvedValue(expiredTrainer as any);
      trainersService.updateSubscription.mockResolvedValue(undefined);
      trainersService.updateProfile.mockResolvedValue(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      expect(trainersService.updateSubscription).toHaveBeenCalledWith(
        expiredTrainer.userId.toString(),
        { subscriptionStatus: SubscriptionStatus.SUSPENDED },
      );
      expect(trainersService.updateProfile).toHaveBeenCalledWith(
        expiredTrainer.userId.toString(),
        { isActive: false },
      );
    });

    it('should throw UnauthorizedException when client profile not found', async () => {
      const context = mockExecutionContext({
        sub: '507f1f77bcf86cd799439011',
        role: UserRole.CLIENT,
      });

      clientsService.getProfile.mockRejectedValue(
        new UnauthorizedException('Client profile not found'),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when trainer profile not found', async () => {
      const context = mockExecutionContext({
        sub: '507f1f77bcf86cd799439011',
        role: UserRole.CLIENT,
      });

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      trainersService.getProfileById.mockResolvedValue(null as any);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});

