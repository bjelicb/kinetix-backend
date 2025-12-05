import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

export type TrainerProfileDocument = TrainerProfile & Document;

@Schema({ timestamps: true })
export class TrainerProfile {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId;

  // SaaS Kill-Switch Fields (CRITICAL)
  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({
    type: String,
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  subscriptionStatus: SubscriptionStatus;

  @Prop({
    type: String,
    enum: ['BASIC', 'PRO', 'ENTERPRISE'],
    default: 'BASIC',
  })
  subscriptionTier: string;

  @Prop({ required: true })
  subscriptionExpiresAt: Date;

  @Prop()
  lastPaymentDate?: Date;

  // Business Info
  @Prop()
  businessName?: string;

  @Prop({ maxlength: 500 })
  bio?: string;

  @Prop({ type: [String], default: [] })
  certifications: string[];

  @Prop({ type: [String], default: [] })
  specializations: string[];

  @Prop()
  yearsExperience?: number;

  // Client Management
  @Prop({ type: [Types.ObjectId], ref: 'ClientProfile', default: [] })
  clientIds: Types.ObjectId[];

  @Prop({ default: 10 })
  maxClients: number;

  // Stripe Integration (Future)
  @Prop()
  stripeCustomerId?: string;

  @Prop()
  stripeSubscriptionId?: string;
}

export const TrainerProfileSchema = SchemaFactory.createForClass(TrainerProfile);

// Indexes
TrainerProfileSchema.index({ userId: 1 }, { unique: true });
TrainerProfileSchema.index({ isActive: 1 });
TrainerProfileSchema.index({ subscriptionExpiresAt: 1 });

