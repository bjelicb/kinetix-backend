import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { TrainerProfile } from '../../trainers/schemas/trainer-profile.schema';

export type ClientProfileDocument = ClientProfile & Document;

export enum FitnessGoal {
  WEIGHT_LOSS = 'WEIGHT_LOSS',
  MUSCLE_GAIN = 'MUSCLE_GAIN',
  ENDURANCE = 'ENDURANCE',
  GENERAL_FITNESS = 'GENERAL_FITNESS',
}

export enum ActivityLevel {
  SEDENTARY = 'SEDENTARY',
  LIGHT = 'LIGHT',
  MODERATE = 'MODERATE',
  VERY_ACTIVE = 'VERY_ACTIVE',
}

@Schema({ timestamps: true })
export class ClientProfile {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'TrainerProfile',
    required: false,
  })
  trainerId?: Types.ObjectId;

  // Client Metrics
  @Prop()
  age?: number;

  @Prop()
  weight?: number; // in kg

  @Prop()
  height?: number; // in cm

  @Prop({
    type: String,
    enum: FitnessGoal,
  })
  fitnessGoal?: FitnessGoal;

  @Prop({
    type: String,
    enum: ActivityLevel,
  })
  activityLevel?: ActivityLevel;

  // Current Plan Assignment (kept for backward compatibility)
  @Prop({
    type: Types.ObjectId,
    ref: 'WeeklyPlan',
  })
  currentPlanId?: Types.ObjectId;

  @Prop()
  planStartDate?: Date;

  @Prop()
  planEndDate?: Date;

  // Plan History - tracks all assigned plans
  @Prop({
    type: [{
      planId: { type: Types.ObjectId, ref: 'WeeklyPlan', required: true },
      planStartDate: { type: Date, required: true },
      planEndDate: { type: Date, required: true },
      assignedAt: { type: Date, default: Date.now },
      trainerId: { type: Types.ObjectId, ref: 'TrainerProfile', required: true },
    }],
    default: [],
  })
  planHistory: Array<{
    planId: Types.ObjectId;
    planStartDate: Date;
    planEndDate: Date;
    assignedAt: Date;
    trainerId: Types.ObjectId;
  }>;

  // Gamification Status
  @Prop({ default: false })
  isPenaltyMode: boolean;

  @Prop({ default: 0 })
  consecutiveMissedWorkouts: number;

  @Prop({ default: 0 })
  totalWorkoutsCompleted: number;

  @Prop({ default: 0 })
  currentStreak: number; // Days in a row

  // Notes
  @Prop()
  medicalConditions?: string;

  @Prop()
  notes?: string;
}

export const ClientProfileSchema = SchemaFactory.createForClass(ClientProfile);

// Indexes
ClientProfileSchema.index({ userId: 1 }, { unique: true });
ClientProfileSchema.index({ trainerId: 1 });
ClientProfileSchema.index({ trainerId: 1, currentPlanId: 1 }); // Compound index for trainer client queries
ClientProfileSchema.index({ currentPlanId: 1 });

