import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AIMessageDocument = AIMessage & Document;

export enum AIMessageTone {
  AGGRESSIVE = 'AGGRESSIVE',
  EMPATHETIC = 'EMPATHETIC',
  MOTIVATIONAL = 'MOTIVATIONAL',
  WARNING = 'WARNING',
}

export enum AIMessageTrigger {
  MISSED_WORKOUTS = 'MISSED_WORKOUTS',
  STREAK = 'STREAK',
  WEIGHT_SPIKE = 'WEIGHT_SPIKE',
  SICK_DAY = 'SICK_DAY',
}

@Schema({ timestamps: true })
export class AIMessage {
  @Prop({ type: Types.ObjectId, ref: 'ClientProfile', required: true })
  clientId: Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({
    type: String,
    enum: AIMessageTone,
    required: true,
  })
  tone: AIMessageTone;

  @Prop({
    type: String,
    enum: AIMessageTrigger,
    required: true,
  })
  trigger: AIMessageTrigger;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>; // Additional data (e.g., missed count, weight change)
}

export const AIMessageSchema = SchemaFactory.createForClass(AIMessage);

// Indexes
AIMessageSchema.index({ clientId: 1, createdAt: -1 });
AIMessageSchema.index({ isRead: 1 });

