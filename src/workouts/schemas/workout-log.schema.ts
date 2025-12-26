import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';
import { TrainerProfile } from '../../trainers/schemas/trainer-profile.schema';
import { WeeklyPlan } from '../../plans/schemas/weekly-plan.schema';
import { DateUtils } from '../../common/utils/date.utils';

export type WorkoutLogDocument = WorkoutLog & Document;

export interface CompletedExercise {
  exerciseName: string;
  actualSets: number;
  actualReps: number[]; // Array of reps per set
  weightUsed?: number; // in kg
  notes?: string;
}

@Schema({ timestamps: true })
export class WorkoutLog {
  @Prop({
    type: Types.ObjectId,
    ref: 'ClientProfile',
    required: true,
  })
  clientId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'TrainerProfile',
    required: true,
  })
  trainerId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'WeeklyPlan',
    required: true,
  })
  weeklyPlanId: Types.ObjectId;

  @Prop({ required: true })
  workoutDate: Date;

  @Prop()
  weekNumber?: number; // Week number in the cycle

  @Prop({ required: true, min: 1, max: 7 })
  dayOfWeek: number; // 1-7 (Plan day index: 1 = first day of plan, 2 = second day, etc.)

  @Prop({
    type: [
      {
        exerciseName: { type: String, required: true },
        actualSets: { type: Number, required: true },
        actualReps: { type: [Number], required: true },
        weightUsed: { type: Number },
        notes: { type: String },
      },
    ],
    default: [],
  })
  completedExercises: CompletedExercise[];

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ default: false })
  isMissed: boolean;

  @Prop()
  completedAt?: Date;

  @Prop()
  workoutStartTime?: Date; // When workout was started

  @Prop({ default: false })
  suspiciousCompletion: boolean; // Flag for workouts completed too quickly

  @Prop({ min: 1, max: 5 })
  difficultyRating?: number; // 1-5 scale

  @Prop()
  clientNotes?: string;
}

export const WorkoutLogSchema = SchemaFactory.createForClass(WorkoutLog);

// Pre-save hook: Auto-normalize workoutDate to start of day
// This ensures ALL workout dates are normalized, regardless of how they're created
// NOTE: This does NOT trigger for findByIdAndUpdate() or updateMany() - those need explicit normalization
WorkoutLogSchema.pre('save', async function() {
  if (this.workoutDate) {
    const normalized = DateUtils.normalizeToStartOfDay(this.workoutDate);
    if (this.workoutDate.getTime() !== normalized.getTime()) {
      console.log(`[WorkoutLogSchema] Auto-normalizing workoutDate from ${this.workoutDate.toISOString()} to ${normalized.toISOString()}`);
      this.workoutDate = normalized;
    }
  }
});

// Compound index for duplicate detection
WorkoutLogSchema.index({ clientId: 1, workoutDate: 1 }, { unique: true });

// Additional indexes
WorkoutLogSchema.index({ trainerId: 1 });
WorkoutLogSchema.index({ trainerId: 1, workoutDate: 1 }); // Compound index for trainer queries
WorkoutLogSchema.index({ weeklyPlanId: 1 });
WorkoutLogSchema.index({ isCompleted: 1 });
WorkoutLogSchema.index({ isMissed: 1 });

