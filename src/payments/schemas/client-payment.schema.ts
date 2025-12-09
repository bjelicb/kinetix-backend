import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';
import { TrainerProfile } from '../../trainers/schemas/trainer-profile.schema';

export type ClientPaymentDocument = ClientPayment & Document;

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class ClientPayment {
  @Prop({ type: Types.ObjectId, ref: 'ClientProfile', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TrainerProfile', required: true })
  trainerId: Types.ObjectId;

  @Prop({ required: true })
  amount: number; // Total amount in euros

  @Prop({ required: true })
  planCost: number; // Base plan cost

  @Prop({ required: true, default: 0 })
  penalties: number; // Accumulated penalties

  @Prop({ required: true, default: 0 })
  kinetixFee: number; // 20% of planCost (for Phase 2)

  @Prop({ required: true, default: 0 })
  trainerPayout: number; // 80% of planCost (for Phase 2)

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Prop()
  stripePaymentIntentId?: string; // Stripe payment intent ID (for Phase 2)

  @Prop()
  paidAt?: Date;
}

export const ClientPaymentSchema = SchemaFactory.createForClass(ClientPayment);

// Indexes
ClientPaymentSchema.index({ clientId: 1, createdAt: -1 });
ClientPaymentSchema.index({ trainerId: 1, createdAt: -1 });
ClientPaymentSchema.index({ status: 1 });

