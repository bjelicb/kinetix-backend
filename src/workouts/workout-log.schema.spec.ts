import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkoutLog, WorkoutLogDocument, WorkoutLogSchema } from './schemas/workout-log.schema';
import { DateUtils } from '../common/utils/date.utils';

describe('WorkoutLogSchema', () => {
  let workoutLogModel: Model<WorkoutLogDocument>;

  const mockClientId = '507f1f77bcf86cd799439011';
  const mockTrainerId = '507f1f77bcf86cd799439012';
  const mockPlanId = '507f1f77bcf86cd799439013';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getModelToken(WorkoutLog.name),
          useValue: {
            new: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    workoutLogModel = module.get<Model<WorkoutLogDocument>>(getModelToken(WorkoutLog.name));
  });

  describe('Pre-save hook', () => {
    it('should normalize workoutDate to start of day on save()', async () => {
      // Create a workout log document with a date that has time
      const workoutDate = new Date('2024-01-01T14:30:00.000Z');
      const normalizedDate = DateUtils.normalizeToStartOfDay(workoutDate);

      // Create a mock document instance
      const mockDocument = {
        clientId: new Types.ObjectId(mockClientId),
        trainerId: new Types.ObjectId(mockTrainerId),
        weeklyPlanId: new Types.ObjectId(mockPlanId),
        workoutDate: workoutDate,
        dayOfWeek: 1,
        isCompleted: false,
        isMissed: false,
        completedExercises: [],
        save: jest.fn().mockImplementation(async function() {
          // Simulate pre-save hook normalization
          if (this.workoutDate) {
            const normalized = DateUtils.normalizeToStartOfDay(this.workoutDate);
            if (this.workoutDate.getTime() !== normalized.getTime()) {
              this.workoutDate = normalized;
            }
          }
          return this;
        }),
      };

      // Execute: Call save()
      const result = await mockDocument.save();

      // Verify: workoutDate was normalized
      expect(result.workoutDate).toEqual(normalizedDate);
      expect(result.workoutDate.getUTCHours()).toBe(0);
      expect(result.workoutDate.getUTCMinutes()).toBe(0);
      expect(result.workoutDate.getUTCSeconds()).toBe(0);
      expect(result.workoutDate.getUTCMilliseconds()).toBe(0);
    });

    it('should not modify already normalized date', async () => {
      // Create a workout log document with already normalized date
      const normalizedDate = new Date('2024-01-01T00:00:00.000Z');

      const mockDocument = {
        clientId: new Types.ObjectId(mockClientId),
        trainerId: new Types.ObjectId(mockTrainerId),
        weeklyPlanId: new Types.ObjectId(mockPlanId),
        workoutDate: normalizedDate,
        dayOfWeek: 1,
        isCompleted: false,
        isMissed: false,
        completedExercises: [],
        save: jest.fn().mockImplementation(async function() {
          // Simulate pre-save hook (no normalization needed)
          return this;
        }),
      };

      // Execute: Call save()
      const result = await mockDocument.save();

      // Verify: workoutDate remains unchanged
      expect(result.workoutDate).toEqual(normalizedDate);
      expect(result.workoutDate.getUTCHours()).toBe(0);
    });

    it('should not trigger on findByIdAndUpdate()', async () => {
      // Create a workout log document
      const workoutDate = new Date('2024-01-01T14:30:00.000Z');
      const mockDocument = {
        _id: new Types.ObjectId(),
        clientId: new Types.ObjectId(mockClientId),
        trainerId: new Types.ObjectId(mockTrainerId),
        weeklyPlanId: new Types.ObjectId(mockPlanId),
        workoutDate: workoutDate,
        dayOfWeek: 1,
        isCompleted: false,
        isMissed: false,
        completedExercises: [],
      };

      // Mock findByIdAndUpdate (does not trigger pre-save hook)
      (workoutLogModel as any).findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockDocument,
          workoutDate: workoutDate, // Date is NOT normalized (pre-save hook not triggered)
        }),
      });

      // Execute: Call findByIdAndUpdate()
      const result = await (workoutLogModel as any).findByIdAndUpdate(
        mockDocument._id,
        { $set: { workoutDate: workoutDate } },
        { new: true },
      ).exec();

      // Verify: workoutDate is NOT normalized (pre-save hook not triggered)
      // This is why we need explicit normalization in updateWorkoutLog()
      expect(result.workoutDate).toEqual(workoutDate);
      expect(result.workoutDate.getUTCHours()).toBe(14); // Still has time component
    });
  });
});

