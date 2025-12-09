import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CheckIn, CheckInDocument } from './schemas/checkin.schema';
import { CreateCheckInDto } from './dto/create-checkin.dto';
import { VerifyCheckInDto } from './dto/verify-checkin.dto';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { VerificationStatus } from '../common/enums/verification-status.enum';

@Injectable()
export class CheckInsService {
  constructor(
    @InjectModel(CheckIn.name) private checkInModel: Model<CheckInDocument>,
    private clientsService: ClientsService,
    @Inject(forwardRef(() => TrainersService))
    private trainersService: TrainersService,
  ) {}

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * Returns distance in meters
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Validate GPS coordinates against trainer's gym location
   * Returns true if within radius, false otherwise
   */
  async validateGpsLocation(
    trainerId: Types.ObjectId,
    checkInLat: number,
    checkInLon: number,
  ): Promise<boolean> {
    const trainerProfile = await this.trainersService.getProfileById(trainerId.toString());
    
    if (!trainerProfile || !trainerProfile.gymLocation) {
      // If no gym location set, allow check-in (backward compatibility)
      return true;
    }

    const gymLat = trainerProfile.gymLocation.latitude;
    const gymLon = trainerProfile.gymLocation.longitude;
    const radius = trainerProfile.gymLocation.radius || 100; // Default 100 meters

    const distance = this.calculateDistance(gymLat, gymLon, checkInLat, checkInLon);
    
    return distance <= radius;
  }

  async createCheckIn(clientId: string, createCheckInDto: CreateCheckInDto): Promise<CheckIn> {
    const clientProfile = await this.clientsService.getProfile(clientId);
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found.');
    }

    // Validate GPS location against trainer's gym location
    if (createCheckInDto.gpsCoordinates && clientProfile.trainerId) {
      const isGymLocation = await this.validateGpsLocation(
        clientProfile.trainerId,
        createCheckInDto.gpsCoordinates.latitude,
        createCheckInDto.gpsCoordinates.longitude,
      );
      
      // Set isGymLocation flag (for verification)
      (createCheckInDto as any).isGymLocation = isGymLocation;
      
      // Note: We don't block check-in if GPS doesn't match - trainer can verify manually
      // But we flag it for review
    }

    const checkIn = new this.checkInModel({
      clientId: (clientProfile as any)._id || clientProfile.userId,
      trainerId: clientProfile.trainerId,
      workoutLogId: createCheckInDto.workoutLogId ? new Types.ObjectId(createCheckInDto.workoutLogId) : undefined,
      checkinDate: new Date(createCheckInDto.checkinDate),
      photoUrl: createCheckInDto.photoUrl,
      thumbnailUrl: createCheckInDto.thumbnailUrl,
      gpsCoordinates: createCheckInDto.gpsCoordinates,
      isGymLocation: (createCheckInDto as any).isGymLocation || false,
      aiConfidenceScore: createCheckInDto.aiConfidenceScore,
      detectedActivities: createCheckInDto.detectedActivities,
      clientNotes: createCheckInDto.clientNotes,
      verificationStatus: VerificationStatus.PENDING,
    });

    return checkIn.save();
  }

  async getCheckInsByClient(clientId: string): Promise<CheckIn[]> {
    const clientProfile = await this.clientsService.getProfile(clientId);
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found.');
    }

    return this.checkInModel
      .find({ clientId: (clientProfile as any)._id || clientProfile.userId })
      .select('clientId trainerId workoutLogId checkinDate photoUrl thumbnailUrl gpsCoordinates verificationStatus verifiedBy verifiedAt rejectionReason aiConfidenceScore detectedActivities isGymLocation clientNotes createdAt updatedAt')
      .sort({ checkinDate: -1 })
      .lean()
      .exec();
  }

  async getCheckInById(checkInId: string): Promise<CheckIn> {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(checkInId)) {
      throw new NotFoundException('Check-in not found');
    }
    const checkIn = await this.checkInModel.findById(checkInId).exec();
    if (!checkIn) {
      throw new NotFoundException('Check-in not found');
    }
    return checkIn;
  }

  async verifyCheckIn(
    checkInId: string,
    trainerUserId: string,
    verifyCheckInDto: VerifyCheckInDto,
  ): Promise<CheckIn> {
    const checkIn = await this.checkInModel.findById(checkInId).exec();
    if (!checkIn) {
      throw new NotFoundException(`Check-in with ID ${checkInId} not found.`);
    }

    // Get trainer profile to get profileId
    const trainerProfile = await this.trainersService.getProfile(trainerUserId);
    const trainerProfileId = (trainerProfile as any)._id.toString();

    // Verify that the trainer is authorized to verify this check-in
    if (checkIn.trainerId.toString() !== trainerProfileId) {
      throw new ForbiddenException('You are not authorized to verify this check-in.');
    }

    checkIn.verificationStatus = verifyCheckInDto.verificationStatus;
    checkIn.verifiedBy = new Types.ObjectId(trainerUserId);
    checkIn.verifiedAt = new Date();
    if (verifyCheckInDto.rejectionReason) {
      checkIn.rejectionReason = verifyCheckInDto.rejectionReason;
    }

    return checkIn.save();
  }

  async getPendingCheckIns(trainerId: string): Promise<CheckIn[]> {
    return this.checkInModel
      .find({
        trainerId: new Types.ObjectId(trainerId),
        verificationStatus: VerificationStatus.PENDING,
      })
      .select('clientId trainerId workoutLogId checkinDate photoUrl thumbnailUrl gpsCoordinates verificationStatus verifiedBy verifiedAt rejectionReason aiConfidenceScore detectedActivities isGymLocation clientNotes createdAt updatedAt')
      .populate('clientId', 'userId')
      .sort({ checkinDate: -1 })
      .lean()
      .exec();
  }

  async getCheckInsByDateRange(
    clientId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CheckIn[]> {
    const clientProfile = await this.clientsService.getProfile(clientId);
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found.');
    }

    return this.checkInModel
      .find({
        clientId: (clientProfile as any)._id || clientProfile.userId,
        checkinDate: { $gte: startDate, $lte: endDate },
      })
      .select('clientId trainerId workoutLogId checkinDate photoUrl thumbnailUrl gpsCoordinates verificationStatus verifiedBy verifiedAt rejectionReason aiConfidenceScore detectedActivities isGymLocation clientNotes createdAt updatedAt')
      .sort({ checkinDate: -1 })
      .lean()
      .exec();
  }

  async deleteCheckIn(checkInId: string, clientId: string): Promise<void> {
    const checkIn = await this.checkInModel.findById(checkInId).exec();
    if (!checkIn) {
      throw new NotFoundException('Check-in not found');
    }

    // Get client profile to verify ownership
    const clientProfile = await this.clientsService.getProfile(clientId);
    const clientProfileId = (clientProfile as any)._id || clientProfile.userId;

    // Verify that the check-in belongs to this client
    if (checkIn.clientId.toString() !== clientProfileId.toString()) {
      throw new ForbiddenException('You can only delete your own check-ins');
    }

    // Hard delete
    await this.checkInModel.findByIdAndDelete(checkInId).exec();
  }
}

