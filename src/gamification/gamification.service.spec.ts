import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GamificationService } from './gamification.service';
import { PenaltyRecord, PenaltyRecordDocument, PenaltyType } from './schemas/penalty-record.schema';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { NotFoundException } from '@nestjs/common';

describe('GamificationService', () => {
  let service: GamificationService;
  let penaltyRecordModel: Model<PenaltyRecordDocument>;
  let clientProfileModel: Model<ClientProfileDocument>;
  let clientsService: jest.Mocked<ClientsService>;
  let testModule: TestingModule;

  const mockClientProfile: Partial<ClientProfileDocument> = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    trainerId: new Types.ObjectId(),
    isPenaltyMode: false,
    consecutiveMissedWorkouts: 0,
    currentStreak: 5,
    totalWorkoutsCompleted: 20,
    save: jest.fn().mockResolvedValue(this),
    toObject: jest.fn().mockReturnThis(),
  };

  const mockPenaltyRecord: Partial<PenaltyRecordDocument> = {
    _id: new Types.ObjectId(),
    clientId: mockClientProfile._id,
    trainerId: mockClientProfile.trainerId,
    weekStartDate: new Date('2025-01-01T00:00:00.000Z'),
    weekEndDate: new Date('2025-01-07T23:59:59.999Z'),
    totalMissedWorkouts: 2,
    totalScheduledWorkouts: 5,
    completionRate: 60,
    isPenaltyApplied: false,
    penaltyType: PenaltyType.WARNING,
    toObject: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    testModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        {
          provide: getModelToken(PenaltyRecord.name),
          useValue: {
            find: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([mockPenaltyRecord]),
          },
        },
        {
          provide: getModelToken(ClientProfile.name),
          useValue: {
            find: jest.fn().mockReturnThis(),
            findById: jest.fn().mockReturnThis(),
            findByIdAndUpdate: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([mockClientProfile]),
          },
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
            getProfile: jest.fn(),
            getProfileById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = testModule.get<GamificationService>(GamificationService);
    penaltyRecordModel = testModule.get<Model<PenaltyRecordDocument>>(
      getModelToken(PenaltyRecord.name),
    );
    clientProfileModel = testModule.get<Model<ClientProfileDocument>>(
      getModelToken(ClientProfile.name),
    );
    clientsService = testModule.get(ClientsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPenaltyStatus', () => {
    it('should return penalty status with recent penalties', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      jest.spyOn(penaltyRecordModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockPenaltyRecord]),
      } as any);

      const result = await service.getPenaltyStatus('clientId1');

      expect(result.isPenaltyMode).toBe(false);
      expect(result.consecutiveMissedWorkouts).toBe(0);
      expect(result.currentStreak).toBe(5);
      expect(result.totalWorkoutsCompleted).toBe(20);
      expect(result.recentPenalties).toHaveLength(1);
      expect(result.recentPenalties[0].penaltyType).toBe(PenaltyType.WARNING);
      expect(penaltyRecordModel.find).toHaveBeenCalledWith({
        clientId: mockClientProfile._id,
      });
    });

    it('should throw NotFoundException if client profile not found', async () => {
      clientsService.getProfile.mockResolvedValue(null);

      await expect(service.getPenaltyStatus('clientId1')).rejects.toThrow(NotFoundException);
    });

    it('should return empty recent penalties if none exist', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      jest.spyOn(penaltyRecordModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.getPenaltyStatus('clientId1');

      expect(result.recentPenalties).toEqual([]);
    });

    it('should limit recentPenalties to 4', async () => {
      const clientProfileId = mockClientProfile._id;
      const manyPenalties = Array.from({ length: 6 }, (_, i) => ({
        ...mockPenaltyRecord,
        _id: new Types.ObjectId(),
        weekStartDate: new Date(`2025-01-${i + 1}`),
      }));

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      const findMock = jest.spyOn(penaltyRecordModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(manyPenalties.slice(0, 4)),
      } as any);

      const result = await service.getPenaltyStatus('clientId1');

      expect(result.recentPenalties).toHaveLength(4);
      expect(findMock().limit).toHaveBeenCalledWith(4);
    });

    it('should sort recentPenalties by weekStartDate descending', async () => {
      const clientProfileId = mockClientProfile._id;
      const penalties = [
        { ...mockPenaltyRecord, weekStartDate: new Date('2025-01-01') },
        { ...mockPenaltyRecord, weekStartDate: new Date('2025-01-08') },
        { ...mockPenaltyRecord, weekStartDate: new Date('2025-01-15') },
      ];

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      const findMock = jest.spyOn(penaltyRecordModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(penalties),
      } as any);

      await service.getPenaltyStatus('clientId1');

      expect(findMock().sort).toHaveBeenCalledWith({ weekStartDate: -1 });
    });

    it('should handle client with null balance and monthlyBalance', async () => {
      const clientWithNullBalance = {
        ...mockClientProfile,
        balance: null,
        monthlyBalance: null,
      };

      clientsService.getProfile.mockResolvedValue(clientWithNullBalance as ClientProfile);
      jest.spyOn(penaltyRecordModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.getPenaltyStatus('clientId1');

      expect(result.balance).toBe(0);
      expect(result.monthlyBalance).toBe(0);
    });
  });

  describe('getPenaltyHistory', () => {
    it('should return all penalty records for a client', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      jest.spyOn(penaltyRecordModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockPenaltyRecord]),
      } as any);

      const result = await service.getPenaltyHistory('clientId1');

      expect(result).toEqual([mockPenaltyRecord]);
      expect(penaltyRecordModel.find).toHaveBeenCalledWith({
        clientId: mockClientProfile._id,
      });
    });

    it('should throw NotFoundException if client profile not found', async () => {
      clientsService.getProfile.mockResolvedValue(null);

      await expect(service.getPenaltyHistory('clientId1')).rejects.toThrow(NotFoundException);
    });

    it('should sort penalty history by weekStartDate descending', async () => {
      const penalties = [
        { ...mockPenaltyRecord, weekStartDate: new Date('2025-01-01') },
        { ...mockPenaltyRecord, weekStartDate: new Date('2025-01-08') },
        { ...mockPenaltyRecord, weekStartDate: new Date('2025-01-15') },
      ];

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfile);
      const findMock = jest.spyOn(penaltyRecordModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(penalties),
      } as any);

      await service.getPenaltyHistory('clientId1');

      expect(findMock().sort).toHaveBeenCalledWith({ weekStartDate: -1 });
    });
  });

  describe('resetPenalty', () => {
    it('should reset penalty mode and consecutive missed workouts', async () => {
      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      const clientWithPenalty = {
        ...mockClientProfile,
        _id: new Types.ObjectId('507f1f77bcf86cd799439016'),
        isPenaltyMode: true,
        consecutiveMissedWorkouts: 3,
        trainerId: trainerProfileId,
        save: jest.fn().mockResolvedValue({
          ...mockClientProfile,
          isPenaltyMode: false,
          consecutiveMissedWorkouts: 0,
        }),
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithPenalty),
      });
      const trainersService = testModule.get(TrainersService);
      (trainersService.getProfile as jest.Mock).mockResolvedValue(trainerProfile as any);

      await service.resetPenalty('507f1f77bcf86cd799439016', trainerId.toString());

      expect((clientWithPenalty as any).isPenaltyMode).toBe(false);
      expect((clientWithPenalty as any).consecutiveMissedWorkouts).toBe(0);
      expect(clientWithPenalty.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if client profile not found', async () => {
      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.resetPenalty('clientId1', 'trainerId1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if trainer does not own the client', async () => {
      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const otherTrainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      const clientWithDifferentTrainer = {
        ...mockClientProfile,
        _id: new Types.ObjectId('507f1f77bcf86cd799439016'),
        trainerId: otherTrainerProfileId,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithDifferentTrainer),
      });
      const trainersService = testModule.get(TrainersService);
      (trainersService.getProfile as jest.Mock).mockResolvedValue(trainerProfile as any);

      await expect(service.resetPenalty('507f1f77bcf86cd799439016', trainerId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if trainer profile not found', async () => {
      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const clientWithPenalty = {
        ...mockClientProfile,
        _id: new Types.ObjectId('507f1f77bcf86cd799439016'),
        trainerId: trainerProfileId,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithPenalty),
      });
      const trainersService = testModule.get(TrainersService);
      (trainersService.getProfile as jest.Mock).mockRejectedValue(new NotFoundException('Trainer profile not found'));

      await expect(service.resetPenalty('507f1f77bcf86cd799439016', trainerId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle client with null trainerId', async () => {
      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      const clientWithNullTrainer = {
        ...mockClientProfile,
        _id: new Types.ObjectId('507f1f77bcf86cd799439016'),
        trainerId: null,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithNullTrainer),
      });
      const trainersService = testModule.get(TrainersService);
      (trainersService.getProfile as jest.Mock).mockResolvedValue(trainerProfile as any);

      await expect(service.resetPenalty('507f1f77bcf86cd799439016', trainerId.toString())).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.resetPenalty('507f1f77bcf86cd799439016', trainerId.toString())).rejects.toThrow(
        'Client not found or not authorized.',
      );
    });
  });

  describe('getLeaderboard', () => {
    it('should return sorted leaderboard by streak and total workouts', async () => {
      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      const clients = [
        {
          _id: new Types.ObjectId(),
          totalWorkoutsCompleted: 20,
          currentStreak: 5,
          isPenaltyMode: false,
          consecutiveMissedWorkouts: 0,
        },
        {
          _id: new Types.ObjectId(),
          totalWorkoutsCompleted: 30,
          currentStreak: 3,
          isPenaltyMode: false,
          consecutiveMissedWorkouts: 0,
        },
        {
          _id: new Types.ObjectId(),
          totalWorkoutsCompleted: 15,
          currentStreak: 5,
          isPenaltyMode: false,
          consecutiveMissedWorkouts: 0,
        },
      ];

      const trainersService = testModule.get(TrainersService);
      (trainersService.getProfile as jest.Mock).mockResolvedValue(trainerProfile as any);
      jest.spyOn(clientProfileModel, 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue(clients),
      } as any);

      const result = await service.getLeaderboard(trainerId.toString());

      expect(result).toHaveLength(3);
      // Should be sorted by streak (descending), then by total workouts (descending)
      expect(result[0].currentStreak).toBe(5);
      expect(result[0].totalWorkoutsCompleted).toBe(20); // Higher total than clientId3
      expect(result[1].currentStreak).toBe(5);
      expect(result[1].totalWorkoutsCompleted).toBe(15);
      expect(result[2].currentStreak).toBe(3);
      expect(clientProfileModel.find).toHaveBeenCalledWith({
        trainerId: expect.any(Types.ObjectId),
      });
    });

    it('should return empty array if no clients found', async () => {
      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      const trainersService = testModule.get(TrainersService);
      (trainersService.getProfile as jest.Mock).mockResolvedValue(trainerProfile as any);
      jest.spyOn(clientProfileModel, 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.getLeaderboard(trainerId.toString());

      expect(result).toEqual([]);
    });

    it('should handle clients with null values', async () => {
      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      const clients = [
        {
          _id: new Types.ObjectId(),
          totalWorkoutsCompleted: null,
          currentStreak: 5,
          isPenaltyMode: false,
          consecutiveMissedWorkouts: 0,
        },
        {
          _id: new Types.ObjectId(),
          totalWorkoutsCompleted: 20,
          currentStreak: null,
          isPenaltyMode: false,
          consecutiveMissedWorkouts: 0,
        },
      ];

      const trainersService = testModule.get(TrainersService);
      (trainersService.getProfile as jest.Mock).mockResolvedValue(trainerProfile as any);
      jest.spyOn(clientProfileModel, 'find').mockReturnValue({
        exec: jest.fn().mockResolvedValue(clients),
      } as any);

      const result = await service.getLeaderboard(trainerId.toString());

      expect(result).toHaveLength(2);
      // Implementation returns null values as-is (not converted to 0)
      expect(result[0].totalWorkoutsCompleted).toBeNull();
      expect(result[1].currentStreak).toBeNull();
    });
  });

  describe('addPenaltyToBalance', () => {
    it('should add penalty to balance and monthlyBalance', async () => {
      const clientProfileId = new Types.ObjectId();
      const amount = 1;
      const reason = 'Missed workout';
      const planId = new Types.ObjectId();

      const clientWithBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 5,
        monthlyBalance: 3,
        penaltyHistory: [],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithBalance,
          balance: 6,
          monthlyBalance: 4,
        }),
      });

      await service.addPenaltyToBalance(clientProfileId, amount, reason, planId);

      // MERODAVNOST PROVERA: Verify that BOTH balance and monthlyBalance are updated
      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        {
          $set: {
            balance: 6, // 5 + 1
            monthlyBalance: 4, // 3 + 1
          },
          $push: {
            penaltyHistory: {
              date: expect.any(Date),
              amount: 1,
              reason: 'Missed workout',
              planId: planId,
            },
          },
        },
      );
    });

    it('should handle client with zero balance', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientWithZeroBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 0,
        monthlyBalance: 0,
        penaltyHistory: [],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithZeroBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithZeroBalance,
          balance: 1,
          monthlyBalance: 1,
        }),
      });

      await service.addPenaltyToBalance(clientProfileId, 1, 'Missed workout');

      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        expect.objectContaining({
          $set: {
            balance: 1,
            monthlyBalance: 1,
          },
        }),
      );
    });

    it('should handle client with null balance', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientWithNullBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: null,
        monthlyBalance: null,
        penaltyHistory: [],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithNullBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithNullBalance,
          balance: 1,
          monthlyBalance: 1,
        }),
      });

      await service.addPenaltyToBalance(clientProfileId, 1, 'Missed workout');

      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        expect.objectContaining({
          $set: {
            balance: 1, // 0 + 1 (null treated as 0)
            monthlyBalance: 1, // 0 + 1 (null treated as 0)
          },
        }),
      );
    });

    it('should throw NotFoundException if client profile not found', async () => {
      const clientProfileId = new Types.ObjectId();

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.addPenaltyToBalance(clientProfileId, 1, 'Missed workout')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.addPenaltyToBalance(clientProfileId, 1, 'Missed workout')).rejects.toThrow(
        'Client profile not found',
      );
    });

    it('should handle multiple penalties accumulating', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientWithBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 5,
        monthlyBalance: 3,
        penaltyHistory: [],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithBalance,
          balance: 6,
          monthlyBalance: 4,
        }),
      });

      // First penalty
      await service.addPenaltyToBalance(clientProfileId, 1, 'Missed workout');

      // Update mock to reflect new balance
      clientWithBalance.balance = 6;
      clientWithBalance.monthlyBalance = 4;

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithBalance,
          balance: 7,
          monthlyBalance: 5,
        }),
      });

      // Second penalty
      await service.addPenaltyToBalance(clientProfileId, 1, 'Missed workout');

      // Verify second penalty adds to existing balance
      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenLastCalledWith(
        clientProfileId,
        expect.objectContaining({
          $set: {
            balance: 7, // 6 + 1
            monthlyBalance: 5, // 4 + 1
          },
        }),
      );
    });

    it('should handle planId as optional parameter', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientWithBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 5,
        monthlyBalance: 3,
        penaltyHistory: [],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithBalance,
          balance: 6,
          monthlyBalance: 4,
        }),
      });

      await service.addPenaltyToBalance(clientProfileId, 1, 'Missed workout'); // No planId

      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        expect.objectContaining({
          $push: expect.objectContaining({
            penaltyHistory: expect.objectContaining({
              amount: 1,
              reason: 'Missed workout',
              planId: undefined, // No planId
            }),
          }),
        }),
      );
    });

    it('should handle clientProfileId as string vs ObjectId', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientProfileIdString = clientProfileId.toString();
      const clientWithBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 5,
        monthlyBalance: 3,
        penaltyHistory: [],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithBalance,
          balance: 6,
          monthlyBalance: 4,
        }),
      });

      // Test with string ID
      await service.addPenaltyToBalance(clientProfileIdString, 1, 'Missed workout');

      expect(clientProfileModel.findById).toHaveBeenCalledWith(clientProfileIdString);

      // Reset mock
      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithBalance),
      });

      // Test with ObjectId
      await service.addPenaltyToBalance(clientProfileId, 1, 'Missed workout');

      expect(clientProfileModel.findById).toHaveBeenCalledWith(clientProfileId);
    });
  });

  describe('clearBalance', () => {
    it('should clear both balance and monthlyBalance', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientWithBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: null,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithBalance,
          balance: 0,
          monthlyBalance: 0,
          lastBalanceReset: expect.any(Date),
        }),
      });

      await service.clearBalance(clientProfileId);

      // MERODAVNOST PROVERA: Verify that BOTH balance and monthlyBalance are cleared
      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        {
          $set: {
            balance: 0,
            monthlyBalance: 0,
            lastBalanceReset: expect.any(Date),
          },
        },
        { new: true },
      );
    });

    it('should handle client with zero balance', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientWithZeroBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 0,
        monthlyBalance: 0,
        lastBalanceReset: null,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithZeroBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithZeroBalance,
          lastBalanceReset: expect.any(Date),
        }),
      });

      await service.clearBalance(clientProfileId);

      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        {
          $set: {
            balance: 0,
            monthlyBalance: 0,
            lastBalanceReset: expect.any(Date),
          },
        },
        { new: true },
      );
    });

    it('should set lastBalanceReset timestamp', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientWithBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: null,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithBalance),
      });

      const resetDate = new Date();
      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithBalance,
          balance: 0,
          monthlyBalance: 0,
          lastBalanceReset: resetDate,
        }),
      });

      await service.clearBalance(clientProfileId);

      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        expect.objectContaining({
          $set: expect.objectContaining({
            lastBalanceReset: expect.any(Date),
          }),
        }),
        { new: true },
      );
    });

    it('should handle edge case: balance = 10€, monthlyBalance = 5€', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientWithDifferentBalances = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5, // Different values
        lastBalanceReset: null,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithDifferentBalances),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithDifferentBalances,
          balance: 0,
          monthlyBalance: 0,
          lastBalanceReset: expect.any(Date),
        }),
      });

      await service.clearBalance(clientProfileId);

      // Both should be cleared to 0
      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        {
          $set: {
            balance: 0,
            monthlyBalance: 0,
            lastBalanceReset: expect.any(Date),
          },
        },
        { new: true },
      );
    });
  });

  describe('removePenaltiesForPlan', () => {
    it('should remove penalties for plan and update balance', async () => {
      const clientProfileId = new Types.ObjectId();
      const planId1 = new Types.ObjectId();
      const planId2 = new Types.ObjectId();
      
      const clientWithPenalties = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 20,
        monthlyBalance: 15,
        penaltyHistory: [
          { planId: planId1, amount: 2, date: new Date(), reason: 'Missed workout' },
          { planId: planId1, amount: 3, date: new Date(), reason: 'Missed workout' },
          { planId: planId2, amount: 5, date: new Date(), reason: 'Missed workout' },
        ],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithPenalties),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithPenalties,
          balance: 15, // 20 - 5 (totalAmount)
          monthlyBalance: 10, // 15 - 5
          penaltyHistory: [{ planId: planId2, amount: 5, date: new Date(), reason: 'Missed workout' }],
        }),
      });

      const result = await service.removePenaltiesForPlan(clientProfileId, planId1);

      expect(result).toBe(2); // 2 penalties removed
      expect(clientProfileModel.findById).toHaveBeenCalledWith(clientProfileId);
      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        expect.objectContaining({
          $set: expect.objectContaining({
            balance: 15, // Math.max(0, 20 - 5)
            monthlyBalance: 10, // Math.max(0, 15 - 5)
            penaltyHistory: expect.arrayContaining([
              expect.objectContaining({
                planId: planId2,
                amount: 5,
                reason: 'Missed workout',
              }),
            ]),
          }),
        }),
      );
    });

    it('should throw NotFoundException if client profile not found', async () => {
      const clientProfileId = new Types.ObjectId();
      const planId = new Types.ObjectId();

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.removePenaltiesForPlan(clientProfileId, planId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.removePenaltiesForPlan(clientProfileId, planId)).rejects.toThrow(
        'Client profile not found',
      );
    });

    it('should return 0 if no penalties found for plan', async () => {
      const clientProfileId = new Types.ObjectId();
      const planId1 = new Types.ObjectId();
      const planId2 = new Types.ObjectId();

      const clientWithOtherPenalties = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        penaltyHistory: [
          { planId: planId2, amount: 5, date: new Date(), reason: 'Missed workout' },
        ],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithOtherPenalties),
      });

      const result = await service.removePenaltiesForPlan(clientProfileId, planId1);

      expect(result).toBe(0);
      expect(clientProfileModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should handle planId as string vs ObjectId', async () => {
      const clientProfileId = new Types.ObjectId();
      const planId = new Types.ObjectId();
      const planIdString = planId.toString();

      const clientWithPenalties = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        penaltyHistory: [
          { planId: planId, amount: 5, date: new Date(), reason: 'Missed workout' },
        ],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithPenalties),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithPenalties,
          balance: 5,
          monthlyBalance: 0,
          penaltyHistory: [],
        }),
      });

      // Test with string planId
      const result1 = await service.removePenaltiesForPlan(clientProfileId, planIdString);
      expect(result1).toBe(1);

      // Reset mock
      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithPenalties),
      });

      // Test with ObjectId planId
      const result2 = await service.removePenaltiesForPlan(clientProfileId, planId);
      expect(result2).toBe(1);
    });

    it('should calculate totalAmount correctly', async () => {
      const clientProfileId = new Types.ObjectId();
      const planId = new Types.ObjectId();

      const clientWithPenalties = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 20,
        monthlyBalance: 15,
        penaltyHistory: [
          { planId: planId, amount: 2, date: new Date(), reason: 'Missed workout' },
          { planId: planId, amount: 3, date: new Date(), reason: 'Missed workout' },
          { planId: planId, amount: 1, date: new Date(), reason: 'Missed workout' },
        ],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithPenalties),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithPenalties,
          balance: 14, // 20 - 6
          monthlyBalance: 9, // 15 - 6
          penaltyHistory: [],
        }),
      });

      const result = await service.removePenaltiesForPlan(clientProfileId, planId);

      expect(result).toBe(3);
      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        expect.objectContaining({
          $set: expect.objectContaining({
            balance: 14, // Math.max(0, 20 - 6)
            monthlyBalance: 9, // Math.max(0, 15 - 6)
            penaltyHistory: [],
          }),
        }),
      );
    });

    it('should not allow negative balance', async () => {
      const clientProfileId = new Types.ObjectId();
      const planId = new Types.ObjectId();

      const clientWithLowBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 5,
        monthlyBalance: 3,
        penaltyHistory: [
          { planId: planId, amount: 10, date: new Date(), reason: 'Missed workout' },
        ],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithLowBalance),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithLowBalance,
          balance: 0, // Math.max(0, 5 - 10) = 0
          monthlyBalance: 0, // Math.max(0, 3 - 10) = 0
          penaltyHistory: [],
        }),
      });

      const result = await service.removePenaltiesForPlan(clientProfileId, planId);

      expect(result).toBe(1);
      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        expect.objectContaining({
          $set: expect.objectContaining({
            balance: 0, // Math.max(0, 5 - 10)
            monthlyBalance: 0, // Math.max(0, 3 - 10)
            penaltyHistory: [],
          }),
        }),
      );
    });

    it('should filter penalties by planId correctly', async () => {
      const clientProfileId = new Types.ObjectId();
      const planId1 = new Types.ObjectId();
      const planId2 = new Types.ObjectId();

      const clientWithMultiplePlans = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 20,
        monthlyBalance: 15,
        penaltyHistory: [
          { planId: planId1, amount: 2, date: new Date(), reason: 'Missed workout' },
          { planId: planId1, amount: 3, date: new Date(), reason: 'Missed workout' },
          { planId: planId2, amount: 5, date: new Date(), reason: 'Missed workout' },
          { planId: planId2, amount: 4, date: new Date(), reason: 'Missed workout' },
        ],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithMultiplePlans),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithMultiplePlans,
          balance: 15, // 20 - 5 (only planId1 penalties removed)
          monthlyBalance: 10, // 15 - 5
          penaltyHistory: [
            { planId: planId2, amount: 5, date: new Date(), reason: 'Missed workout' },
            { planId: planId2, amount: 4, date: new Date(), reason: 'Missed workout' },
          ],
        }),
      });

      const result = await service.removePenaltiesForPlan(clientProfileId, planId1);

      expect(result).toBe(2); // Only planId1 penalties removed
      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        expect.objectContaining({
          $set: expect.objectContaining({
            balance: 15,
            monthlyBalance: 10,
            penaltyHistory: expect.arrayContaining([
              expect.objectContaining({ planId: planId2, amount: 5 }),
              expect.objectContaining({ planId: planId2, amount: 4 }),
            ]),
          }),
        }),
      );
    });

    it('should handle penalties without planId', async () => {
      const clientProfileId = new Types.ObjectId();
      const planId = new Types.ObjectId();

      const clientWithMixedPenalties = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 15,
        monthlyBalance: 10,
        penaltyHistory: [
          { planId: planId, amount: 5, date: new Date(), reason: 'Missed workout' },
          { amount: 3, date: new Date(), reason: 'Manual penalty' }, // No planId
          { planId: null, amount: 2, date: new Date(), reason: 'Other penalty' }, // planId is null
        ],
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithMixedPenalties),
      });

      (clientProfileModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...clientWithMixedPenalties,
          balance: 10, // 15 - 5 (only planId penalty removed)
          monthlyBalance: 5, // 10 - 5
          penaltyHistory: [
            { amount: 3, date: new Date(), reason: 'Manual penalty' },
            { planId: null, amount: 2, date: new Date(), reason: 'Other penalty' },
          ],
        }),
      });

      const result = await service.removePenaltiesForPlan(clientProfileId, planId);

      expect(result).toBe(1); // Only 1 penalty with planId removed
      expect(clientProfileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        clientProfileId,
        expect.objectContaining({
          $set: expect.objectContaining({
            balance: 10,
            monthlyBalance: 5,
            penaltyHistory: expect.arrayContaining([
              expect.objectContaining({ amount: 3, reason: 'Manual penalty' }),
              expect.objectContaining({ planId: null, amount: 2, reason: 'Other penalty' }),
            ]),
          }),
        }),
      );
    });
  });

  describe('checkMonthlyPaywall', () => {
    it('should return true if no lastBalanceReset (first time)', async () => {
      const clientProfileId = new Types.ObjectId();
      const clientWithoutReset = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: null,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithoutReset),
      });

      const result = await service.checkMonthlyPaywall(clientProfileId);

      expect(result).toBe(true);
    });

    it('should return true if same month and balance > 0', async () => {
      const clientProfileId = new Types.ObjectId();
      const now = new Date();
      const clientSameMonth = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: now, // Same month
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientSameMonth),
      });

      const result = await service.checkMonthlyPaywall(clientProfileId);

      expect(result).toBe(true);
    });

    it('should return false if new month and balance > 0', async () => {
      const clientProfileId = new Types.ObjectId();
      // Use explicit date to avoid setMonth() issues (e.g., Jan 31 - 1 month = Mar 3)
      // Use December 2024 to ensure it's definitely a different month
      const lastMonth = new Date('2024-12-15T00:00:00.000Z');
      
      const clientNewMonth = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: lastMonth,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientNewMonth),
      });

      const result = await service.checkMonthlyPaywall(clientProfileId);

      // MERODAVNOST PROVERA: Should block access if new month and balance > 0
      // Logika: (currentMonth !== lastResetMonth || currentYear !== lastResetYear) && balance > 0 → false
      expect(result).toBe(false);
    });

    it('should return true if new month and balance = 0', async () => {
      const clientProfileId = new Types.ObjectId();
      // Use explicit date to avoid setMonth() issues
      const lastMonth = new Date('2024-12-15T00:00:00.000Z');
      
      const clientNewMonthZeroBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 0,
        monthlyBalance: 0,
        lastBalanceReset: lastMonth,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientNewMonthZeroBalance),
      });

      const result = await service.checkMonthlyPaywall(clientProfileId);

      expect(result).toBe(true);
    });

    it('should return false if new year and balance > 0', async () => {
      const clientProfileId = new Types.ObjectId();
      // Use explicit date from last year
      const lastYear = new Date('2024-12-15T00:00:00.000Z');
      
      const clientNewYear = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: lastYear,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientNewYear),
      });

      const result = await service.checkMonthlyPaywall(clientProfileId);

      expect(result).toBe(false);
    });

    it('should return false if client profile not found', async () => {
      const clientProfileId = new Types.ObjectId();

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.checkMonthlyPaywall(clientProfileId);

      expect(result).toBe(false);
    });

    it('should handle edge case: balance = 0, monthlyBalance > 0', async () => {
      const clientProfileId = new Types.ObjectId();
      // Use explicit date to avoid setMonth() issues
      const lastMonth = new Date('2024-12-15T00:00:00.000Z');
      
      const clientWithMonthlyBalance = {
        ...mockClientProfile,
        _id: clientProfileId,
        balance: 0, // balance is 0
        monthlyBalance: 10, // but monthlyBalance > 0
        lastBalanceReset: lastMonth,
      };

      (clientProfileModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithMonthlyBalance),
      });

      const result = await service.checkMonthlyPaywall(clientProfileId);

      // MERODAVNOST PROVERA: checkMonthlyPaywall checks only balance, not monthlyBalance
      // So it should return true (balance = 0), even though monthlyBalance > 0
      // This might be a logic issue - should it check monthlyBalance too?
      expect(result).toBe(true);
    });
  });
});

