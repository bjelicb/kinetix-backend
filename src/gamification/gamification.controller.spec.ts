import { Test, TestingModule } from '@nestjs/testing';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { AIMessageService } from './ai-message.service';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PenaltyType } from './schemas/penalty-record.schema';
import { Types } from 'mongoose';
import { GenerateMessageDto } from './dto/generate-message.dto';
import { AIMessageTrigger, AIMessageTone } from './schemas/ai-message.schema';

describe('GamificationController', () => {
  let controller: GamificationController;
  let gamificationService: jest.Mocked<GamificationService>;
  let clientsService: jest.Mocked<ClientsService>;
  let aiMessageService: jest.Mocked<AIMessageService>;

  const mockGamificationService = {
    getPenaltyStatus: jest.fn(),
    getPenaltyHistory: jest.fn(),
    resetPenalty: jest.fn(),
    getLeaderboard: jest.fn(),
    clearBalance: jest.fn(),
  };

  const mockClientsService = {
    getProfile: jest.fn(),
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
          provide: AIMessageService,
          useValue: {
            generateMessage: jest.fn(),
            getAllMessages: jest.fn(),
            getMessages: jest.fn(),
            markAsRead: jest.fn(),
          },
        },
        {
          provide: ClientsService,
          useValue: mockClientsService,
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
    clientsService = module.get(ClientsService);
    aiMessageService = module.get(AIMessageService);
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

  describe('getBalance', () => {
    it('should return balance and monthlyBalance for authenticated client', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 15.5,
        monthlyBalance: 10.0,
        lastBalanceReset: new Date('2025-01-01T00:00:00.000Z'),
        penaltyHistory: [
          {
            weekStartDate: new Date('2025-01-01'),
            weekEndDate: new Date('2025-01-07'),
            amount: 5.0,
          },
        ],
      };

      mockClientsService.getProfile.mockResolvedValue(mockClient as any);

      const result = await controller.getBalance(mockClientJwtPayload);

      expect(mockClientsService.getProfile).toHaveBeenCalledWith(mockClientJwtPayload.sub);
      expect(result).toEqual({
        balance: 15.5,
        monthlyBalance: 10.0,
        lastBalanceReset: new Date('2025-01-01T00:00:00.000Z'),
        penaltyHistory: [
          {
            weekStartDate: new Date('2025-01-01'),
            weekEndDate: new Date('2025-01-07'),
            amount: 5.0,
          },
        ],
      });
    });

    it('should return default values if balance is null/undefined', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: null,
        monthlyBalance: undefined,
        lastBalanceReset: null,
        penaltyHistory: null,
      };

      mockClientsService.getProfile.mockResolvedValue(mockClient as any);

      const result = await controller.getBalance(mockClientJwtPayload);

      expect(result).toEqual({
        balance: 0,
        monthlyBalance: 0,
        lastBalanceReset: null,
        penaltyHistory: [],
      });
    });

    it('should throw NotFoundException if client profile not found', async () => {
      mockClientsService.getProfile.mockRejectedValue(
        new NotFoundException('Client profile not found'),
      );

      await expect(controller.getBalance(mockClientJwtPayload)).rejects.toThrow(NotFoundException);
      expect(mockClientsService.getProfile).toHaveBeenCalledWith(mockClientJwtPayload.sub);
    });
  });

  describe('clearBalance', () => {
    it('should clear balance for authenticated client', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 15.5,
        monthlyBalance: 10.0,
        lastBalanceReset: new Date('2025-01-01T00:00:00.000Z'),
      };

      mockClientsService.getProfile.mockResolvedValue(mockClient as any);
      mockGamificationService.clearBalance.mockResolvedValue(undefined);

      const result = await controller.clearBalance(mockClientJwtPayload);

      expect(mockClientsService.getProfile).toHaveBeenCalledWith(mockClientJwtPayload.sub);
      expect(mockGamificationService.clearBalance).toHaveBeenCalledWith(clientProfileId);
      expect(result).toEqual({ message: 'Balance cleared successfully' });
    });

    it('should clear balance even if balance is 0', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 0,
        monthlyBalance: 0,
        lastBalanceReset: new Date('2025-01-01T00:00:00.000Z'),
      };

      mockClientsService.getProfile.mockResolvedValue(mockClient as any);
      mockGamificationService.clearBalance.mockResolvedValue(undefined);

      const result = await controller.clearBalance(mockClientJwtPayload);

      expect(mockGamificationService.clearBalance).toHaveBeenCalledWith(clientProfileId);
      expect(result).toEqual({ message: 'Balance cleared successfully' });
    });

    it('should throw NotFoundException if client profile not found', async () => {
      mockClientsService.getProfile.mockRejectedValue(
        new NotFoundException('Client profile not found'),
      );

      await expect(controller.clearBalance(mockClientJwtPayload)).rejects.toThrow(NotFoundException);
      expect(mockClientsService.getProfile).toHaveBeenCalledWith(mockClientJwtPayload.sub);
      expect(mockGamificationService.clearBalance).not.toHaveBeenCalled();
    });

    it('should propagate errors from gamificationService.clearBalance', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 15.5,
        monthlyBalance: 10.0,
      };

      mockClientsService.getProfile.mockResolvedValue(mockClient as any);
      const error = new Error('Database error');
      mockGamificationService.clearBalance.mockRejectedValue(error);

      await expect(controller.clearBalance(mockClientJwtPayload)).rejects.toThrow('Database error');
      expect(mockGamificationService.clearBalance).toHaveBeenCalledWith(clientProfileId);
    });
  });

  describe('generateMessage', () => {
    it('should generate AI message', async () => {
      const dto: GenerateMessageDto = {
        clientId: '507f1f77bcf86cd799439012',
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
        metadata: { missedCount: 3 },
      };
      const mockMessage = {
        _id: new Types.ObjectId(),
        clientId: new Types.ObjectId(dto.clientId),
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
        tone: AIMessageTone.AGGRESSIVE,
        message: 'Test message',
        isRead: false,
        createdAt: new Date(),
      };
      aiMessageService.generateMessage.mockResolvedValue(mockMessage as any);

      const result = await controller.generateMessage(dto);

      expect(aiMessageService.generateMessage).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockMessage);
    });

    it('should handle error when AIMessageService fails', async () => {
      const dto: GenerateMessageDto = {
        clientId: '507f1f77bcf86cd799439012',
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
      };
      aiMessageService.generateMessage.mockRejectedValue(new Error('AI service error'));

      await expect(controller.generateMessage(dto)).rejects.toThrow('AI service error');
    });
  });

  describe('getAllMessages', () => {
    it('should return all messages for ADMIN', async () => {
      const mockMessages = [
        {
          _id: new Types.ObjectId(),
          clientId: new Types.ObjectId(),
          trigger: AIMessageTrigger.MISSED_WORKOUTS,
          tone: AIMessageTone.AGGRESSIVE,
          message: 'Test message',
          isRead: false,
        },
      ];
      aiMessageService.getAllMessages.mockResolvedValue(mockMessages as any);

      const result = await controller.getAllMessages();

      expect(aiMessageService.getAllMessages).toHaveBeenCalled();
      expect(result).toEqual(mockMessages);
    });

    it('should handle error when AIMessageService fails', async () => {
      aiMessageService.getAllMessages.mockRejectedValue(new Error('AI service error'));

      await expect(controller.getAllMessages()).rejects.toThrow('AI service error');
    });
  });

  describe('getMessages', () => {
    const clientId = '507f1f77bcf86cd799439012';

    it('should return messages for CLIENT (own messages)', async () => {
      const clientProfileId = new Types.ObjectId(clientId);
      const mockClient = {
        _id: clientProfileId,
      };
      mockClientsService.getProfile.mockResolvedValue(mockClient as any);

      const mockMessages = [
        {
          _id: new Types.ObjectId(),
          clientId: clientProfileId,
          trigger: AIMessageTrigger.MISSED_WORKOUTS,
          message: 'Test message',
        },
      ];
      aiMessageService.getMessages.mockResolvedValue(mockMessages as any);

      const result = await controller.getMessages(clientId, mockClientJwtPayload);

      expect(mockClientsService.getProfile).toHaveBeenCalledWith(mockClientJwtPayload.sub);
      expect(aiMessageService.getMessages).toHaveBeenCalledWith(clientId);
      expect(result).toEqual(mockMessages);
    });

    it('should return Forbidden for CLIENT accessing other client messages', async () => {
      const otherClientId = '507f1f77bcf86cd799439013';
      const clientProfileId = new Types.ObjectId('507f1f77bcf86cd799439012');
      const mockClient = {
        _id: clientProfileId,
      };
      mockClientsService.getProfile.mockResolvedValue(mockClient as any);

      const result = await controller.getMessages(otherClientId, mockClientJwtPayload);

      expect(result).toEqual({ message: 'Forbidden' });
      expect(aiMessageService.getMessages).not.toHaveBeenCalled();
    });

    it('should return messages for TRAINER', async () => {
      const mockMessages = [
        {
          _id: new Types.ObjectId(),
          clientId: new Types.ObjectId(clientId),
          trigger: AIMessageTrigger.MISSED_WORKOUTS,
          message: 'Test message',
        },
      ];
      aiMessageService.getMessages.mockResolvedValue(mockMessages as any);

      const result = await controller.getMessages(clientId, mockTrainerJwtPayload);

      expect(aiMessageService.getMessages).toHaveBeenCalledWith(clientId);
      expect(result).toEqual(mockMessages);
    });

    it('should handle error when AIMessageService fails', async () => {
      aiMessageService.getMessages.mockRejectedValue(new Error('AI service error'));

      await expect(
        controller.getMessages(clientId, mockTrainerJwtPayload),
      ).rejects.toThrow('AI service error');
    });
  });

  describe('markMessageAsRead', () => {
    const messageId = '507f1f77bcf86cd799439012';

    it('should mark message as read', async () => {
      aiMessageService.markAsRead.mockResolvedValue(undefined);

      const result = await controller.markMessageAsRead(messageId);

      expect(aiMessageService.markAsRead).toHaveBeenCalledWith(messageId);
      expect(result).toEqual({ message: 'Message marked as read' });
    });

    it('should handle error when AIMessageService fails', async () => {
      aiMessageService.markAsRead.mockRejectedValue(new Error('AI service error'));

      await expect(controller.markMessageAsRead(messageId)).rejects.toThrow('AI service error');
    });
  });

  describe('getPenaltyHistory error handling', () => {
    it('should handle error when GamificationService fails', async () => {
      gamificationService.getPenaltyHistory.mockRejectedValue(new Error('Service error'));

      await expect(controller.getPenaltyHistory(mockClientJwtPayload)).rejects.toThrow('Service error');
    });
  });

  describe('getLeaderboard error handling', () => {
    it('should handle error when GamificationService fails', async () => {
      gamificationService.getLeaderboard.mockRejectedValue(new Error('Service error'));

      await expect(controller.getLeaderboard(mockTrainerJwtPayload)).rejects.toThrow('Service error');
    });
  });
});
