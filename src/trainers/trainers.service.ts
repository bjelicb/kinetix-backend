import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TrainerProfile,
  TrainerProfileDocument,
} from './schemas/trainer-profile.schema';
import {
  ClientProfile,
  ClientProfileDocument,
} from '../clients/schemas/client-profile.schema';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { SubscriptionUpdateDto } from './dto/subscription-update.dto';
import { AssignClientDto } from './dto/assign-client.dto';
import { UpgradeSubscriptionDto, SubscriptionTier } from './dto/upgrade-subscription.dto';
import { PenaltyRecord, PenaltyRecordDocument } from '../gamification/schemas/penalty-record.schema';
import { Appointment, AppointmentDocument } from './schemas/appointment.schema';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import { AppLogger } from '../common/utils/logger.utils';

@Injectable()
export class TrainersService {
  constructor(
    @InjectModel(TrainerProfile.name)
    private trainerModel: Model<TrainerProfileDocument>,
    @InjectModel(ClientProfile.name)
    private clientModel: Model<ClientProfileDocument>,
    @InjectModel(PenaltyRecord.name)
    private penaltyRecordModel: Model<PenaltyRecordDocument>,
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
  ) {}

  async createProfile(
    userId: string,
    dto: CreateTrainerDto,
  ): Promise<TrainerProfile> {
    // Set default subscription (30 days from now)
    const subscriptionExpiresAt = new Date();
    subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 30);

    const trainerProfile = new this.trainerModel({
      userId: new Types.ObjectId(userId),
      ...dto,
      subscriptionExpiresAt,
      isActive: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE, // Explicitly set to ACTIVE
    });

    return trainerProfile.save();
  }

  async getProfile(userId: string): Promise<TrainerProfile> {
    const profile = await this.trainerModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'email firstName lastName')
      .exec();

    if (!profile) {
      throw new NotFoundException('Trainer profile not found');
    }

    return profile;
  }

  async getProfileById(profileId: string | Types.ObjectId): Promise<TrainerProfile> {
    const profile = await this.trainerModel
      .findById(profileId)
      .exec();

    if (!profile) {
      throw new NotFoundException('Trainer profile not found');
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    dto: UpdateTrainerDto,
  ): Promise<TrainerProfile> {
    const profile = await this.trainerModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: dto },
        { new: true },
      )
      .exec();

    if (!profile) {
      throw new NotFoundException('Trainer profile not found');
    }

    return profile;
  }

  async getClients(userId: string): Promise<any[]> {
    const profile = await this.getProfile(userId);
    const trainerProfileId = (profile as any)._id;
    
    // Find all clients with this trainerId
    const clients = await this.clientModel
      .find({ trainerId: trainerProfileId })
      .populate('userId', 'email firstName lastName')
      .populate('currentPlanId', 'name')
      .exec();

    return clients.map((client: any) => ({
      _id: client._id,
      userId: client.userId,
      trainerId: client.trainerId,
      currentPlanId: client.currentPlanId,
      fitnessGoal: client.fitnessGoal,
      activityLevel: client.activityLevel,
      totalWorkoutsCompleted: client.totalWorkoutsCompleted,
      currentStreak: client.currentStreak,
      isPenaltyMode: client.isPenaltyMode,
    }));
  }

  async updateSubscription(
    userId: string,
    dto: SubscriptionUpdateDto,
  ): Promise<TrainerProfile> {
    const updateData: any = {};

    if (dto.subscriptionStatus) {
      updateData.subscriptionStatus = dto.subscriptionStatus;
    }

    if (dto.subscriptionTier) {
      updateData.subscriptionTier = dto.subscriptionTier;
    }

    if (dto.subscriptionExpiresAt) {
      updateData.subscriptionExpiresAt = new Date(dto.subscriptionExpiresAt);
    }

    if (dto.lastPaymentDate) {
      updateData.lastPaymentDate = new Date(dto.lastPaymentDate);
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    const profile = await this.trainerModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: updateData },
        { new: true },
      )
      .exec();

    if (!profile) {
      throw new NotFoundException('Trainer profile not found');
    }

    return profile;
  }

  async assignClientToTrainer(
    userId: string,
    clientProfileId: string,
  ): Promise<{ message: string; clientId: string }> {
    // Get trainer profile
    const trainerProfile = await this.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;

    // Check if trainer has reached max clients
    const currentClients = await this.clientModel.countDocuments({
      trainerId: trainerProfileId,
    }).exec();

    if (currentClients >= trainerProfile.maxClients) {
      throw new BadRequestException(
        `Maximum number of clients (${trainerProfile.maxClients}) reached. Please upgrade your subscription.`,
      );
    }

    // Get client profile
    const clientProfile = await this.clientModel.findById(clientProfileId).exec();
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found');
    }

    // Check if client is already assigned to another trainer
    if (clientProfile.trainerId && clientProfile.trainerId.toString() !== trainerProfileId.toString()) {
      throw new BadRequestException('Client is already assigned to another trainer');
    }

    // If already assigned to this trainer, return success (idempotent)
    if (clientProfile.trainerId && clientProfile.trainerId.toString() === trainerProfileId.toString()) {
      return {
        message: 'Client already assigned to this trainer',
        clientId: clientProfileId,
      };
    }

    // Update client's trainerId
    await this.clientModel.findByIdAndUpdate(
      clientProfileId,
      { $set: { trainerId: trainerProfileId } },
    ).exec();

    // Add client to trainer's clientIds array
    await this.trainerModel.findByIdAndUpdate(
      trainerProfileId,
      { $addToSet: { clientIds: new Types.ObjectId(clientProfileId) } },
    ).exec();

    return {
      message: 'Client assigned successfully',
      clientId: clientProfileId,
    };
  }

  async removeClientFromTrainer(
    userId: string,
    clientProfileId: string,
  ): Promise<{ message: string; clientId: string }> {
    // Get trainer profile
    const trainerProfile = await this.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;

    // Get client profile
    const clientProfile = await this.clientModel.findById(clientProfileId).exec();
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found');
    }

    // Check if client belongs to this trainer
    if (!clientProfile.trainerId || clientProfile.trainerId.toString() !== trainerProfileId.toString()) {
      throw new ForbiddenException('Client does not belong to this trainer');
    }

    // Remove trainerId from client
    await this.clientModel.findByIdAndUpdate(
      clientProfileId,
      { $set: { trainerId: null } },
    ).exec();

    // Remove client from trainer's clientIds array
    await this.trainerModel.findByIdAndUpdate(
      trainerProfileId,
      { $pull: { clientIds: new Types.ObjectId(clientProfileId) } },
    ).exec();

    return {
      message: 'Client removed successfully',
      clientId: clientProfileId,
    };
  }

  async upgradeSubscription(
    userId: string,
    dto: UpgradeSubscriptionDto,
  ): Promise<TrainerProfile> {
    const trainerProfile = await this.getProfile(userId);
    const currentTier = trainerProfile.subscriptionTier as string;

    // Define tier hierarchy
    const tierHierarchy = {
      BASIC: 1,
      PRO: 2,
      ENTERPRISE: 3,
    };

    const currentTierLevel = tierHierarchy[currentTier as keyof typeof tierHierarchy] || 0;
    const newTierLevel = tierHierarchy[dto.newTier];

    // Validate that new tier is higher than current tier
    if (newTierLevel <= currentTierLevel) {
      throw new BadRequestException(
        `Cannot upgrade to ${dto.newTier}. Current tier is ${currentTier}. You can only upgrade to a higher tier.`,
      );
    }

    // Define max clients per tier
    const maxClientsByTier = {
      BASIC: 10,
      PRO: 50,
      ENTERPRISE: 999,
    };

    const newMaxClients = maxClientsByTier[dto.newTier];

    // Update subscription tier and max clients
    const updatedProfile = await this.trainerModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          $set: {
            subscriptionTier: dto.newTier,
            maxClients: newMaxClients,
          },
        },
        { new: true },
      )
      .exec();

    if (!updatedProfile) {
      throw new NotFoundException('Trainer profile not found');
    }

    return updatedProfile;
  }

  /**
   * Get pending week requests from clients
   */
  async getPendingWeekRequests(trainerId: string): Promise<ClientProfile[]> {
    AppLogger.logOperation('NEXT_WEEK_REQUESTS_GET', {
      trainerId,
    }, 'debug');

    // Get trainer profile to get trainerProfileId
    const trainerProfile = await this.getProfile(trainerId);
    const trainerProfileId = (trainerProfile as any)._id;

    const clients = await this.clientModel
      .find({
        trainerId: trainerProfileId,
        nextWeekRequested: true,
      })
      .populate('userId', 'firstName lastName email')
      .lean()
      .exec();

    AppLogger.logOperation('NEXT_WEEK_REQUESTS_GET', {
      trainerId,
      count: clients.length,
    }, 'info');

    return clients as ClientProfile[];
  }

  /**
   * Verify that a client belongs to the trainer
   * This method is used by other services (like WorkoutsService) to verify trainer-client relationship
   * @param trainerId Trainer's userId
   * @param clientProfileId Client's profile ID
   * @throws ForbiddenException if client does not belong to trainer
   * @throws NotFoundException if client not found
   */
  async verifyClientBelongsToTrainer(
    trainerId: string,
    clientProfileId: string,
  ): Promise<ClientProfileDocument> {
    const trainerProfile = await this.getProfile(trainerId);
    const trainerProfileId = (trainerProfile as any)._id;

    const clientProfile = await this.clientModel.findById(clientProfileId).exec();
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found');
    }

    if (!clientProfile.trainerId || clientProfile.trainerId.toString() !== trainerProfileId.toString()) {
      throw new ForbiddenException('Client does not belong to this trainer');
    }

    return clientProfile;
  }

  /**
   * Get all active alerts for a trainer
   * Combines pending requests, recent penalties, and status changes
   */
  async getAlerts(userId: string): Promise<any[]> {
    console.log(`[TrainersService] getAlerts START - userId: ${userId}`);
    const trainerProfile = await this.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;
    console.log(`[TrainersService] trainerProfileId: ${trainerProfileId}`);

    const alerts: any[] = [];

    // 1. Get Pending Week Requests
    const pendingRequests = await this.clientModel
      .find({
        trainerId: trainerProfileId,
        nextWeekRequested: true,
      })
      .populate('userId', 'firstName lastName')
      .lean()
      .exec();

    console.log(`[TrainersService] pendingRequests found: ${pendingRequests.length}`);

    pendingRequests.forEach((client: any) => {
      alerts.push({
        id: client._id.toString(),
        clientName: `${client.userId?.firstName || ''} ${client.userId?.lastName || ''}`.trim(),
        message: 'Requested next week plan',
        type: 'pending_request',
        timestamp: client.updatedAt || new Date(),
      });
    });

    // 2. Get Recent Penalties (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPenalties = await this.penaltyRecordModel
      .find({
        trainerId: trainerProfileId,
        createdAt: { $gte: sevenDaysAgo },
      })
      .populate({
        path: 'clientId',
        populate: { path: 'userId', select: 'firstName lastName' }
      })
      .lean()
      .exec();

    recentPenalties.forEach((penalty: any) => {
      let message = '';
      let type = '';

      if (penalty.penaltyType === 'PENALTY_MODE') {
        message = `Missed ${penalty.totalMissedWorkouts} workouts. Penalty applied.`;
        type = 'missed_workout';
      } else if (penalty.penaltyType === 'WARNING') {
        message = `Low adherence warning (${penalty.totalMissedWorkouts} missed)`;
        type = 'low_adherence';
      }

      if (message) {
        alerts.push({
          id: penalty.clientId?._id?.toString() || penalty._id.toString(),
          clientName: `${penalty.clientId?.userId?.firstName || ''} ${penalty.clientId?.userId?.lastName || ''}`.trim(),
          message,
          type,
          timestamp: penalty.createdAt,
        });
      }
    });

    // Sort by timestamp descending
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAppointments(userId: string): Promise<any[]> {
    const trainerProfile = await this.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;

    // Get appointments from today onwards
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.appointmentModel
      .find({
        trainerId: trainerProfileId,
        time: { $gte: todayStart },
      })
      .populate({
        path: 'clientId',
        populate: { path: 'userId', select: 'firstName lastName avatar' },
      })
      .sort({ time: 1 })
      .lean()
      .exec();
  }
}

