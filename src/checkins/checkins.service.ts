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

  async createCheckIn(clientId: string, createCheckInDto: CreateCheckInDto): Promise<CheckIn> {
    const clientProfile = await this.clientsService.getProfile(clientId);
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found.');
    }

    const checkIn = new this.checkInModel({
      clientId: (clientProfile as any)._id || clientProfile.userId,
      trainerId: clientProfile.trainerId,
      workoutLogId: createCheckInDto.workoutLogId ? new Types.ObjectId(createCheckInDto.workoutLogId) : undefined,
      checkinDate: new Date(createCheckInDto.checkinDate),
      photoUrl: createCheckInDto.photoUrl,
      thumbnailUrl: createCheckInDto.thumbnailUrl,
      gpsCoordinates: createCheckInDto.gpsCoordinates,
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

