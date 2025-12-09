import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { WeeklyPlan } from '../../plans/schemas/weekly-plan.schema';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';

export type PlanEffectivenessDocument = PlanEffectiveness & Document;

@Schema({ timestamps: true })
export class PlanEffectiveness {
  @Prop({ type: Types.ObjectId, ref: 'WeeklyPlan', required: true })
  planId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ClientProfile', required: true })
  clientId: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 100 })
  completionRate: number; // % of workouts completed

  @Prop({ required: true, default: 0 })
  averagePerformance: number; // Average weight/reps improvement

  @Prop()
  clientFeedback?: string; // Optional feedback from client

  @Prop()
  trainerNotes?: string; // Trainer's assessment

  @Prop({ required: true })
  weekStartDate: Date; // Week this effectiveness data is for

  @Prop({ required: true })
  weekEndDate: Date;
}

export const PlanEffectivenessSchema = SchemaFactory.createForClass(PlanEffectiveness);

// Indexes
PlanEffectivenessSchema.index({ planId: 1, clientId: 1, weekStartDate: -1 });
PlanEffectivenessSchema.index({ clientId: 1, weekStartDate: -1 });

