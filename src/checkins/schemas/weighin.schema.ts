import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';
import { WeeklyPlan } from '../../plans/schemas/weekly-plan.schema';

export type WeighInDocument = WeighIn & Document;

@Schema({ timestamps: true })
export class WeighIn {
  @Prop({ type: Types.ObjectId, ref: 'ClientProfile', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WeeklyPlan' })
  planId?: Types.ObjectId; // Link to the plan this weigh-in belongs to

  @Prop()
  planStartDate?: Date; // Start date of the plan week this weigh-in belongs to

  @Prop({ required: true })
  weight: number; // in kg

  @Prop({ required: true })
  date: Date; // Date when weigh-in was recorded (can be any day)

  @Prop()
  photoUrl?: string; // Optional scale photo

  @Prop()
  notes?: string; // Client explanation if spike detected

  @Prop({ default: false })
  isMandatory: boolean; // True if this weigh-in is on Monday (plan start day)

  @Prop({ default: false })
  aiFlagged?: boolean; // AI detected spike

  @Prop()
  aiMessage?: string; // AI's "demand for explanation"

  @Prop({ default: false })
  isWeightSpike: boolean; // Flag if weight increased significantly
}

export const WeighInSchema = SchemaFactory.createForClass(WeighIn);

// Indexes
WeighInSchema.index({ clientId: 1, date: 1 }, { unique: true }); // One weigh-in per client per date
WeighInSchema.index({ clientId: 1, date: -1 }); // For getting latest weigh-ins
WeighInSchema.index({ planId: 1, planStartDate: -1 }); // For getting weigh-ins by plan
WeighInSchema.index({ clientId: 1, planId: 1, date: -1 }); // For getting weigh-ins by client and plan

