import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TrainerProfile } from '../../trainers/schemas/trainer-profile.schema';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';
import { WorkoutDifficulty } from '../../common/enums/workout-difficulty.enum';

export type WeeklyPlanDocument = WeeklyPlan & Document;

export interface Exercise {
  name: string;
  sets: number;
  reps: number | string; // Can be "10-12" or number
  restSeconds: number;
  notes?: string;
  videoUrl?: string;
}

export interface WorkoutDay {
  dayOfWeek: number; // 1-7 (Monday-Sunday)
  isRestDay: boolean;
  name: string;
  exercises: Exercise[];
  estimatedDuration: number; // in minutes
  notes?: string;
}

@Schema({ timestamps: true })
export class WeeklyPlan {
  @Prop({
    type: Types.ObjectId,
    ref: 'TrainerProfile',
    required: true,
  })
  trainerId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({
    type: String,
    enum: WorkoutDifficulty,
    default: WorkoutDifficulty.INTERMEDIATE,
  })
  difficulty: WorkoutDifficulty;

  @Prop({
    type: [
      {
        dayOfWeek: { type: Number, required: true, min: 1, max: 7 },
        isRestDay: { type: Boolean, default: false },
        name: { type: String, required: true },
        exercises: {
          type: [
            {
              name: { type: String, required: true },
              sets: { type: Number, required: true },
              reps: { type: String, required: true },
              restSeconds: { type: Number, default: 60 },
              notes: { type: String },
              videoUrl: { type: String },
            },
          ],
          default: [],
        },
        estimatedDuration: { type: Number, default: 60 },
        notes: { type: String },
      },
    ],
    default: [],
  })
  workouts: WorkoutDay[];

  @Prop({
    type: [Types.ObjectId],
    ref: 'ClientProfile',
    default: [],
  })
  assignedClientIds: Types.ObjectId[];

  @Prop({ default: true })
  isTemplate: boolean;

  // Weekly Plan Cost (for Running Tab system)
  @Prop({ default: 0 })
  weeklyCost: number; // Cost in euros per week
}

export const WeeklyPlanSchema = SchemaFactory.createForClass(WeeklyPlan);

// Indexes
WeeklyPlanSchema.index({ trainerId: 1 });
WeeklyPlanSchema.index({ trainerId: 1, isTemplate: 1 }); // Compound index for getPlans
WeeklyPlanSchema.index({ isTemplate: 1 });

