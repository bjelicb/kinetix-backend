import { Test, TestingModule } from '@nestjs/testing';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PenaltyType } from './schemas/penalty-record.schema';
import { Types } from 'mongoose';

describe('GamificationController', () => {
  let controller: GamificationController;
  let gamificationService: jest.Mocked<GamificationService>;

  const mockGamificationService = {
    getPenaltyStatus: jest.fn(),
    getPenaltyHistory: jest.fn(),
    resetPenalty: jest.fn(),
    getLeaderboard: jest.fn(),
  };

  const mockClientJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439012',
    email: 'client@test.com',
    role: 'CLIENT',
    iat: 1234567890,
    exp: 1234567890,
  };

  const mockTrainerJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439011',
    email: 'trainer@test.com',
    role: 'TRAINER',
    iat: 1234567890,
    exp: 1234567890,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamificationController],
      providers: [
        {
          provide: GamificationService,
          useValue: mockGamificationService,
        },
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
          },
        },
      ],
    }).compile();

    controller = module.get<GamificationController>(GamificationController);
    gamificationService = module.get(GamificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPenaltyStatus', () => {
    it('should return penalty status for client', async () => {
      const mockStatus = {
        isPenaltyMode: false,
        consecutiveMissedWorkouts: 0,
        currentStreak: 5,
        totalWorkoutsCompleted: 20,
        recentPenalties: [
          {
            weekStartDate: new Date('2024-01-01'),
            weekEndDate: new Date('2024-01-07'),
            totalMissedWorkouts: 2,
            penaltyType: PenaltyType.WARNING,
          },
        ],
      };
      gamificationService.getPenaltyStatus.mockResolvedValue(mockStatus);

      const result = await controller.getPenaltyStatus(mockClientJwtPayload);

      expect(gamificationService.getPenaltyStatus).toHaveBeenCalledWith(mockClientJwtPayload.sub);
      expect(result).toEqual(mockStatus);
    });

    it('should throw NotFoundException if client profile not found', async () => {
      gamificationService.getPenaltyStatus.mockRejectedValue(
        new NotFoundException('Client profile not found'),
      );

      await expect(controller.getPenaltyStatus(mockClientJwtPayload)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPenaltyHistory', () => {
    it('should return penalty history for client', async () => {
      const mockHistory = [
        {
          _id: new Types.ObjectId(),
          weekStartDate: new Date('2024-01-01'),
          weekEndDate: new Date('2024-01-07'),
          totalMissedWorkouts: 3,
          penaltyType: PenaltyType.PENALTY_MODE,
        },
      ];
      gamificationService.getPenaltyHistory.mockResolvedValue(mockHistory as any);

      const result = await controller.getPenaltyHistory(mockClientJwtPayload);

      expect(gamificationService.getPenaltyHistory).toHaveBeenCalledWith(mockClientJwtPayload.sub);
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard for trainer', async () => {
      const mockLeaderboard = [
        {
          clientId: new Types.ObjectId(),
          totalWorkoutsCompleted: 20,
          currentStreak: 5,
          isPenaltyMode: false,
          consecutiveMissedWorkouts: 0,
        },
      ];
      gamificationService.getLeaderboard.mockResolvedValue(mockLeaderboard as any);

      const result = await controller.getLeaderboard(mockTrainerJwtPayload);

      expect(gamificationService.getLeaderboard).toHaveBeenCalledWith(mockTrainerJwtPayload.sub);
      expect(result).toEqual(mockLeaderboard);
    });
  });

  describe('resetPenalty', () => {
    const clientId = '507f1f77bcf86cd799439021';

    it('should reset penalty for client', async () => {
      gamificationService.resetPenalty.mockResolvedValue(undefined);

      const result = await controller.resetPenalty(clientId, mockTrainerJwtPayload);

      expect(gamificationService.resetPenalty).toHaveBeenCalledWith(clientId, mockTrainerJwtPayload.sub);
      expect(result).toEqual({ message: 'Penalty reset successfully' });
    });

    it('should throw NotFoundException if client not found or not authorized', async () => {
      gamificationService.resetPenalty.mockRejectedValue(
        new NotFoundException('Client not found or not authorized'),
      );

      await expect(controller.resetPenalty(clientId, mockTrainerJwtPayload)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
