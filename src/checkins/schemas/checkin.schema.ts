import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ClientProfile } from '../../clients/schemas/client-profile.schema';
import { TrainerProfile } from '../../trainers/schemas/trainer-profile.schema';
import { WorkoutLog } from '../../workouts/schemas/workout-log.schema';
import { VerificationStatus } from '../../common/enums/verification-status.enum';

export type CheckInDocument = CheckIn & Document;

@Schema({ _id: false })
class GpsCoordinates {
  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop()
  accuracy: number; // in meters
}

const GpsCoordinatesSchema = SchemaFactory.createForClass(GpsCoordinates);

@Schema({ timestamps: true })
export class CheckIn {
  @Prop({ type: Types.ObjectId, ref: 'ClientProfile', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TrainerProfile', required: true })
  trainerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WorkoutLog' })
  workoutLogId: Types.ObjectId;

  @Prop({ required: true })
  checkinDate: Date;

  @Prop({ required: true })
  photoUrl: string; // Cloudinary URL

  @Prop()
  thumbnailUrl: string; // Cloudinary thumbnail transformation

  @Prop({ type: GpsCoordinatesSchema, required: true })
  gpsCoordinates: GpsCoordinates;

  @Prop({
    type: String,
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus: VerificationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedBy: Types.ObjectId; // TrainerID or AI system

  @Prop({ type: Date })
  verifiedAt: Date;

  @Prop()
  rejectionReason: string;

  // AI Analysis Fields (Future)
  @Prop()
  aiConfidenceScore: number; // 0-1, ML model confidence

  @Prop([String])
  detectedActivities: string[]; // e.g., ['weightlifting', 'gym_equipment']

  @Prop()
  isGymLocation: boolean; // GPS verification

  @Prop()
  clientNotes: string;
}

export const CheckInSchema = SchemaFactory.createForClass(CheckIn);

CheckInSchema.index({ clientId: 1, checkinDate: 1 }, { unique: true });
CheckInSchema.index({ trainerId: 1, verificationStatus: 1 }); // Compound index for getPendingCheckIns

