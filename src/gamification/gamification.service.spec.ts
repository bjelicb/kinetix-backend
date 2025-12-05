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
  });
});

