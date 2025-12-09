import { Test, TestingModule } from '@nestjs/testing';
import { TrainingController } from './training.controller';
import { TrainingService, SyncResult } from './training.service';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

describe('TrainingController', () => {
  let controller: TrainingController;
  let trainingService: jest.Mocked<TrainingService>;

  const mockTrainingService = {
    syncBatch: jest.fn(),
    getSyncChanges: jest.fn(),
  };

  const mockClientsService = {
    getProfile: jest.fn(),
  };

  const mockTrainersService = {
    getProfileById: jest.fn(),
  };

  const mockClientJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439012',
    email: 'client@test.com',
    role: 'CLIENT',
    iat: 1234567890,
    exp: 1234567890,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrainingController],
      providers: [
        {
          provide: TrainingService,
          useValue: mockTrainingService,
        },
        {
          provide: ClientsService,
          useValue: mockClientsService,
        },
        {
          provide: TrainersService,
          useValue: mockTrainersService,
        },
      ],
    }).compile();

    controller = module.get<TrainingController>(TrainingController);
    trainingService = module.get(TrainingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncBatch', () => {
    const syncDto: SyncBatchDto = {
      syncedAt: '2024-01-01T00:00:00.000Z',
      newLogs: [
        {
          workoutDate: '2024-01-01T00:00:00.000Z',
          weeklyPlanId: '507f1f77bcf86cd799439030',
          dayOfWeek: 1,
          completedExercises: [],
          isCompleted: true,
        },
      ],
      newCheckIns: [],
    };

    it('should sync batch successfully', async () => {
      const mockResult: SyncResult = {
        processedLogs: 1,
        processedCheckIns: 0,
        errors: [],
      };
      trainingService.syncBatch.mockResolvedValue(mockResult);

      const result = await controller.syncBatch(mockClientJwtPayload, syncDto);

      expect(trainingService.syncBatch).toHaveBeenCalledWith(mockClientJwtPayload.sub, syncDto);
      expect(result).toHaveProperty('processedLogs', 1);
      expect(result).toHaveProperty('processedCheckIns', 0);
    });

    it('should handle errors in sync batch', async () => {
      const mockResult: SyncResult = {
        processedLogs: 0,
        processedCheckIns: 0,
        errors: [
          {
            type: 'LOG',
            index: 0,
            reason: 'Workout log not found',
          },
        ],
      };
      trainingService.syncBatch.mockResolvedValue(mockResult);

      const result = await controller.syncBatch(mockClientJwtPayload, syncDto);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('LOG');
    });

    it('should throw NotFoundException if client profile not found', async () => {
      trainingService.syncBatch.mockRejectedValue(
        new NotFoundException('Client profile not found'),
      );

      await expect(controller.syncBatch(mockClientJwtPayload, syncDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should process both logs and check-ins', async () => {
      const syncDtoWithBoth: SyncBatchDto = {
        syncedAt: '2024-01-01T00:00:00.000Z',
        newLogs: [
          {
            workoutDate: '2024-01-01T00:00:00.000Z',
            weeklyPlanId: '507f1f77bcf86cd799439030',
            dayOfWeek: 1,
            completedExercises: [],
            isCompleted: true,
          },
        ],
        newCheckIns: [
          {
            checkinDate: '2024-01-01T00:00:00.000Z',
            photoUrl: 'https://cloudinary.com/image.jpg',
            gpsCoordinates: { latitude: 40.7128, longitude: -74.006, accuracy: 10 },
          },
        ],
      };

      const mockResult: SyncResult = {
        processedLogs: 1,
        processedCheckIns: 1,
        errors: [],
      };
      trainingService.syncBatch.mockResolvedValue(mockResult);

      const result = await controller.syncBatch(mockClientJwtPayload, syncDtoWithBoth);

      expect(result.processedLogs).toBe(1);
      expect(result.processedCheckIns).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getSyncChanges', () => {
    const mockSyncChanges = {
      workouts: [{ _id: '1', workoutDate: new Date() }],
      plans: [{ _id: '2', name: 'Test Plan' }],
      checkIns: [{ _id: '3', checkinDate: new Date() }],
      lastSync: new Date(),
      totalRecords: 3,
    };

    it('should get sync changes successfully for CLIENT', async () => {
      trainingService.getSyncChanges.mockResolvedValue(mockSyncChanges);

      const result = await controller.getSyncChanges(mockClientJwtPayload, '2024-01-01T00:00:00.000Z');

      expect(trainingService.getSyncChanges).toHaveBeenCalledWith(
        mockClientJwtPayload.sub,
        mockClientJwtPayload.role,
        expect.any(Date),
      );
      expect(result.workouts).toHaveLength(1);
      expect(result.totalRecords).toBe(3);
    });

    it('should get sync changes with default date if since not provided', async () => {
      trainingService.getSyncChanges.mockResolvedValue(mockSyncChanges);

      await controller.getSyncChanges(mockClientJwtPayload, '');

      expect(trainingService.getSyncChanges).toHaveBeenCalledWith(
        mockClientJwtPayload.sub,
        mockClientJwtPayload.role,
        expect.any(Date),
      );
    });

    it('should handle TRAINER role', async () => {
      const trainerPayload: JwtPayload = {
        ...mockClientJwtPayload,
        role: 'TRAINER',
      };
      trainingService.getSyncChanges.mockResolvedValue(mockSyncChanges);

      const result = await controller.getSyncChanges(trainerPayload, '2024-01-01T00:00:00.000Z');

      expect(trainingService.getSyncChanges).toHaveBeenCalledWith(
        trainerPayload.sub,
        'TRAINER',
        expect.any(Date),
      );
      expect(result).toBeDefined();
    });

    it('should handle ADMIN role', async () => {
      const adminPayload: JwtPayload = {
        ...mockClientJwtPayload,
        role: 'ADMIN',
      };
      trainingService.getSyncChanges.mockResolvedValue(mockSyncChanges);

      const result = await controller.getSyncChanges(adminPayload, '2024-01-01T00:00:00.000Z');

      expect(trainingService.getSyncChanges).toHaveBeenCalledWith(
        adminPayload.sub,
        'ADMIN',
        expect.any(Date),
      );
      expect(result).toBeDefined();
    });
  });
});
