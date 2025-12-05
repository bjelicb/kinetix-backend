import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { TrainingService, SyncResult } from './training.service';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { CheckInsService } from '../checkins/checkins.service';
import { WorkoutLog } from '../workouts/schemas/workout-log.schema';
import { CheckIn } from '../checkins/schemas/checkin.schema';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { Types } from 'mongoose';

describe('TrainingService', () => {
  let service: TrainingService;
  let clientsService: jest.Mocked<ClientsService>;
  let workoutsService: jest.Mocked<WorkoutsService>;
  let checkInsService: jest.Mocked<CheckInsService>;
  let workoutLogModel: jest.Mocked<Model<any>>;

  const mockClientId = '507f1f77bcf86cd799439011';
  const mockClientProfile = {
    _id: new Types.ObjectId(mockClientId),
    userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
    trainerId: new Types.ObjectId('507f1f77bcf86cd799439013'),
  };

  const mockWorkoutLog = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439014'),
    clientId: new Types.ObjectId(mockClientId),
    workoutDate: new Date('2024-01-01'),
    isCompleted: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingService,
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
        {
          provide: WorkoutsService,
          useValue: {
            getWeekWorkouts: jest.fn(),
            updateWorkoutLog: jest.fn(),
          },
        },
        {
          provide: CheckInsService,
          useValue: {
            getCheckInsByDateRange: jest.fn(),
            createCheckIn: jest.fn(),
          },
        },
        {
          provide: getModelToken(WorkoutLog.name),
          useValue: {
            bulkWrite: jest.fn(),
          },
        },
        {
          provide: getModelToken(CheckIn.name),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TrainingService>(TrainingService);
    clientsService = module.get(ClientsService);
    workoutsService = module.get(WorkoutsService);
    checkInsService = module.get(CheckInsService);
    workoutLogModel = module.get(getModelToken(WorkoutLog.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncBatch', () => {
    it('should throw NotFoundException if client profile not found', async () => {
      clientsService.getProfile.mockRejectedValue(
        new NotFoundException('Client profile not found'),
      );

      const syncDto: SyncBatchDto = {
        newLogs: [],
        newCheckIns: [],
      };

      await expect(service.syncBatch(mockClientId, syncDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should process workout logs successfully', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      workoutsService.getWeekWorkouts.mockResolvedValue([mockWorkoutLog as any]);
      workoutLogModel.bulkWrite.mockResolvedValue({ modifiedCount: 1 } as any);

      const syncDto: SyncBatchDto = {
        newLogs: [
          {
            workoutDate: '2024-01-01T00:00:00.000Z',
            completedExercises: [
              {
                exerciseName: 'Squat',
                actualSets: 3,
                actualReps: [10, 10, 10],
                weightUsed: 100,
              },
            ],
            isCompleted: true,
          },
        ],
        newCheckIns: [],
      };

      const result = await service.syncBatch(mockClientId, syncDto);

      expect(result.processedLogs).toBe(1);
      expect(result.processedCheckIns).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(workoutLogModel.bulkWrite).toHaveBeenCalled();
    });

    it('should handle workout log not found error', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      workoutsService.getWeekWorkouts.mockResolvedValue([]);

      const syncDto: SyncBatchDto = {
        newLogs: [
          {
            workoutDate: '2024-01-01T00:00:00.000Z',
            completedExercises: [],
            isCompleted: true,
          },
        ],
        newCheckIns: [],
      };

      const result = await service.syncBatch(mockClientId, syncDto);

      expect(result.processedLogs).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('LOG');
      expect(result.errors[0].reason).toContain('Workout log not found');
    });

    it('should process check-ins successfully', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      checkInsService.getCheckInsByDateRange.mockResolvedValue([]);
      checkInsService.createCheckIn.mockResolvedValue({
        _id: new Types.ObjectId(),
        clientId: new Types.ObjectId(mockClientId),
        checkinDate: new Date('2024-01-01'),
      } as any);

      const syncDto: SyncBatchDto = {
        newLogs: [],
        newCheckIns: [
          {
            checkinDate: '2024-01-01T00:00:00.000Z',
            photoUrl: 'https://cloudinary.com/image.jpg',
            thumbnailUrl: 'https://cloudinary.com/thumb.jpg',
            gpsCoordinates: {
              latitude: 40.7128,
              longitude: -74.006,
              accuracy: 10,
            },
          },
        ],
      };

      const result = await service.syncBatch(mockClientId, syncDto);

      expect(result.processedLogs).toBe(0);
      expect(result.processedCheckIns).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(checkInsService.createCheckIn).toHaveBeenCalled();
    });

    it('should detect duplicate check-ins', async () => {
      const existingCheckIn = {
        _id: new Types.ObjectId(),
        clientId: new Types.ObjectId(mockClientId),
        checkinDate: new Date('2024-01-01'),
      };

      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      checkInsService.getCheckInsByDateRange.mockResolvedValue([existingCheckIn as any]);

      const syncDto: SyncBatchDto = {
        newLogs: [],
        newCheckIns: [
          {
            checkinDate: '2024-01-01T00:00:00.000Z',
            photoUrl: 'https://cloudinary.com/image.jpg',
            thumbnailUrl: 'https://cloudinary.com/thumb.jpg',
            gpsCoordinates: {
              latitude: 40.7128,
              longitude: -74.006,
              accuracy: 10,
            },
          },
        ],
      };

      const result = await service.syncBatch(mockClientId, syncDto);

      expect(result.processedCheckIns).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('CHECKIN');
      expect(result.errors[0].reason).toContain('already exists');
      expect(checkInsService.createCheckIn).not.toHaveBeenCalled();
    });

    it('should handle partial success with errors', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      
      // First log succeeds - mockWorkoutLog has workoutDate matching first log
      const firstLog = {
        ...mockWorkoutLog,
        _id: new Types.ObjectId('507f1f77bcf86cd799439014'),
        workoutDate: new Date('2024-01-01T00:00:00.000Z'),
      };
      const secondLog = {
        ...mockWorkoutLog,
        _id: new Types.ObjectId('507f1f77bcf86cd799439015'),
        workoutDate: new Date('2024-01-02T00:00:00.000Z'),
      };
      // Mock getWeekWorkouts - called once per log in bulk phase, then again in individual phase
      workoutsService.getWeekWorkouts
        .mockResolvedValueOnce([firstLog as any]) // First call in bulk phase - first log
        .mockResolvedValueOnce([secondLog as any]) // Second call in bulk phase - second log
        .mockResolvedValueOnce([firstLog as any]) // Third call in individual phase - first log
        .mockResolvedValueOnce([secondLog as any]); // Fourth call in individual phase - second log
      
      // Mock bulkWrite to fail, forcing fallback to individual updates
      workoutLogModel.bulkWrite.mockRejectedValueOnce(new Error('Bulk write failed'));
      
      workoutsService.updateWorkoutLog
        .mockResolvedValueOnce(firstLog as any) // First update succeeds
        .mockRejectedValueOnce(new Error('Update failed')); // Second update fails

      const syncDto: SyncBatchDto = {
        newLogs: [
          {
            workoutDate: '2024-01-01T00:00:00.000Z',
            completedExercises: [],
            isCompleted: true,
          },
          {
            workoutDate: '2024-01-02T00:00:00.000Z',
            completedExercises: [],
            isCompleted: true,
          },
        ],
        newCheckIns: [],
      };

      const result = await service.syncBatch(mockClientId, syncDto);

      expect(result.processedLogs).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
    });

    it('should handle errors during workout log update', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      workoutsService.getWeekWorkouts.mockResolvedValue([mockWorkoutLog as any]);
      // Mock bulkWrite to fail, forcing fallback to individual updates
      workoutLogModel.bulkWrite.mockRejectedValueOnce(new Error('Bulk write failed'));
      workoutsService.updateWorkoutLog.mockRejectedValue(new Error('Update failed'));

      const syncDto: SyncBatchDto = {
        newLogs: [
          {
            workoutDate: '2024-01-01T00:00:00.000Z',
            completedExercises: [],
            isCompleted: true,
          },
        ],
        newCheckIns: [],
      };

      const result = await service.syncBatch(mockClientId, syncDto);

      expect(result.processedLogs).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toBe('Update failed');
    });

    it('should handle errors during check-in creation', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      checkInsService.getCheckInsByDateRange.mockResolvedValue([]);
      checkInsService.createCheckIn.mockRejectedValue(new Error('Creation failed'));

      const syncDto: SyncBatchDto = {
        newLogs: [],
        newCheckIns: [
          {
            checkinDate: '2024-01-01T00:00:00.000Z',
            photoUrl: 'https://cloudinary.com/image.jpg',
            thumbnailUrl: 'https://cloudinary.com/thumb.jpg',
            gpsCoordinates: {
              latitude: 40.7128,
              longitude: -74.006,
              accuracy: 10,
            },
          },
        ],
      };

      const result = await service.syncBatch(mockClientId, syncDto);

      expect(result.processedCheckIns).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toBe('Creation failed');
    });

    it('should process both logs and check-ins in one batch', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      workoutsService.getWeekWorkouts.mockResolvedValue([mockWorkoutLog as any]);
      workoutsService.updateWorkoutLog.mockResolvedValue(mockWorkoutLog as any);
      checkInsService.getCheckInsByDateRange.mockResolvedValue([]);
      checkInsService.createCheckIn.mockResolvedValue({
        _id: new Types.ObjectId(),
        clientId: new Types.ObjectId(mockClientId),
        checkinDate: new Date('2024-01-01'),
      } as any);

      const syncDto: SyncBatchDto = {
        newLogs: [
          {
            workoutDate: '2024-01-01T00:00:00.000Z',
            completedExercises: [],
            isCompleted: true,
          },
        ],
        newCheckIns: [
          {
            checkinDate: '2024-01-01T00:00:00.000Z',
            photoUrl: 'https://cloudinary.com/image.jpg',
            thumbnailUrl: 'https://cloudinary.com/thumb.jpg',
            gpsCoordinates: {
              latitude: 40.7128,
              longitude: -74.006,
              accuracy: 10,
            },
          },
        ],
      };

      const result = await service.syncBatch(mockClientId, syncDto);

      expect(result.processedLogs).toBe(1);
      expect(result.processedCheckIns).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });
});

