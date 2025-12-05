import { VerificationStatus } from '../../common/enums/verification-status.enum';

export class CheckInResponseDto {
  id: string;
  clientId: string;
  trainerId: string;
  workoutLogId?: string;
  checkinDate: Date;
  photoUrl: string;
  thumbnailUrl?: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: Date;
  rejectionReason?: string;
  aiConfidenceScore?: number;
  detectedActivities?: string[];
  isGymLocation?: boolean;
  clientNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

