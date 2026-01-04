import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';
import { TrainerProfile } from './trainer-profile.schema';

export type AppointmentDocument = Appointment & Document;

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum AppointmentType {
  CHECK_IN = 'CHECK_IN',
  CONSULTATION = 'CONSULTATION',
  TRAINING = 'TRAINING',
  NUTRITION = 'NUTRITION',
}

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TrainerProfile', required: true, index: true })
  trainerId: MongooseSchema.Types.ObjectId | TrainerProfile;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ClientProfile', required: true, index: true })
  clientId: MongooseSchema.Types.ObjectId | ClientProfile;

  @Prop({ required: true })
  time: Date;

  @Prop({ default: 60 }) // duration in minutes
  duration: number;

  @Prop({
    type: String,
    enum: AppointmentType,
    default: AppointmentType.CHECK_IN,
  })
  type: AppointmentType;

  @Prop({
    type: String,
    enum: AppointmentStatus,
    default: AppointmentStatus.SCHEDULED,
  })
  status: AppointmentStatus;

  @Prop()
  notes?: string;

  @Prop()
  location?: string;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
