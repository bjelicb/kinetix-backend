import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';
import { TrainerProfile } from '../../trainers/schemas/trainer-profile.schema';

export type PenaltyRecordDocument = PenaltyRecord & Document;

export enum PenaltyType {
  WARNING = 'WARNING',
  PENALTY_MODE = 'PENALTY_MODE',
  NONE = 'NONE',
}

@Schema({ timestamps: true })
export class PenaltyRecord {
  @Prop({ type: Types.ObjectId, ref: 'ClientProfile', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TrainerProfile', required: true })
  trainerId: Types.ObjectId;

  @Prop({ required: true })
  weekStartDate: Date;

  @Prop({ required: true })
  weekEndDate: Date;

  @Prop({ required: true })
  totalMissedWorkouts: number;

  @Prop({ required: true })
  totalScheduledWorkouts: number;

  @Prop()
  completionRate: number; // Percentage

  @Prop({ default: false })
  isPenaltyApplied: boolean;

  @Prop({
    type: String,
    enum: PenaltyType,
    required: true,
  })
  penaltyType: PenaltyType;

  @Prop()
  trainerNotes: string;
}

export const PenaltyRecordSchema = SchemaFactory.createForClass(PenaltyRecord);

PenaltyRecordSchema.index({ clientId: 1, weekStartDate: 1 }, { unique: true });

