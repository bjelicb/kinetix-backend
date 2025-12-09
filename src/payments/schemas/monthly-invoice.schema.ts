import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';

export type MonthlyInvoiceDocument = MonthlyInvoice & Document;

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

@Schema({ timestamps: true })
export class MonthlyInvoice {
  @Prop({ type: Types.ObjectId, ref: 'ClientProfile', required: true })
  clientId: Types.ObjectId;

  @Prop({ required: true })
  month: Date; // First day of month

  @Prop({ required: true })
  totalBalance: number; // Total amount due

  @Prop({ required: true, default: 0 })
  planCosts: number; // Sum of all plan costs for the month

  @Prop({ required: true, default: 0 })
  penalties: number; // Sum of all penalties for the month

  @Prop({
    type: String,
    enum: InvoiceStatus,
    default: InvoiceStatus.UNPAID,
  })
  status: InvoiceStatus;

  @Prop({ required: true })
  dueDate: Date; // End of month

  @Prop()
  paidAt?: Date;
}

export const MonthlyInvoiceSchema = SchemaFactory.createForClass(MonthlyInvoice);

// Indexes
MonthlyInvoiceSchema.index({ clientId: 1, month: -1 }, { unique: true }); // One invoice per client per month
MonthlyInvoiceSchema.index({ status: 1, dueDate: 1 }); // For finding overdue invoices

