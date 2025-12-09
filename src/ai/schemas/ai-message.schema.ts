import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';

export type AIMessageDocument = AIMessage & Document;

export enum MessageType {
  MOTIVATION = 'MOTIVATION',
  WARNING = 'WARNING',
  PENALTY = 'PENALTY',
  CELEBRATION = 'CELEBRATION',
  PASSIVE_AGGRESSIVE = 'PASSIVE_AGGRESSIVE',
  EMPATHY = 'EMPATHY',
}

@Schema({ timestamps: true })
export class AIMessage {
  @Prop({ type: Types.ObjectId, ref: 'ClientProfile', required: true })
  clientId: Types.ObjectId;

  @Prop({
    type: String,
    enum: MessageType,
    required: true,
  })
  messageType: MessageType;

  @Prop({ required: true })
  content: string; // The actual message text

  @Prop({ required: true })
  generatedAt: Date;

  @Prop({ default: false })
  trainerApproved?: boolean; // For V2, trainer can review before sending

  @Prop()
  sentAt?: Date; // When message was actually sent (push notification)

  @Prop()
  context?: string; // JSON string with context data used to generate message
}

export const AIMessageSchema = SchemaFactory.createForClass(AIMessage);

// Indexes
AIMessageSchema.index({ clientId: 1, generatedAt: -1 });
AIMessageSchema.index({ messageType: 1 });
AIMessageSchema.index({ trainerApproved: 1, sentAt: 1 }); // For pending messages

