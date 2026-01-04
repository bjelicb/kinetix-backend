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
    unique: true,
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

  @Prop({
    type: {
      calories: { type: Number, default: 2000 },
      protein: { type: Number, default: 150 },
      carbs: { type: Number, default: 250 },
      fats: { type: Number, default: 70 },
    },
    default: { calories: 2000, protein: 150, carbs: 250, fats: 70 },
    _id: false,
  })
  macroTargets: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };

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

  // Request Next Week feature (V2)
  @Prop({ default: false })
  nextWeekRequested: boolean;

  @Prop()
  nextWeekRequestDate?: Date;

  @Prop({ default: 0 })
  currentStreak: number; // Days in a row

  // Running Tab / Penalty Balance System
  @Prop({ default: 0 })
  balance: number; // Running tab balance in euros

  @Prop({ default: 0 })
  monthlyBalance: number; // Current month's accumulated balance

  @Prop()
  lastBalanceReset?: Date; // When balance was last cleared

  @Prop({
    type: [{
      date: { type: Date, required: true },
      amount: { type: Number, required: true }, // e.g., 1€ per missed workout
      reason: { type: String, required: true }, // "Missed workout", "Plan cost"
      planId: { type: Types.ObjectId, ref: 'WeeklyPlan' },
    }],
    default: [],
  })
  penaltyHistory: Array<{
    date: Date;
    amount: number;
    reason: string;
    planId?: Types.ObjectId;
  }>;

  // Notes
  @Prop()
  medicalConditions?: string;

  @Prop()
  notes?: string;
}

export const ClientProfileSchema = SchemaFactory.createForClass(ClientProfile);

// Indexes
ClientProfileSchema.index({ trainerId: 1 });
ClientProfileSchema.index({ trainerId: 1, currentPlanId: 1 }); // Compound index for trainer client queries
ClientProfileSchema.index({ currentPlanId: 1 });

