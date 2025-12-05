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
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';

@Injectable()
export class TrainersService {
  constructor(
    @InjectModel(TrainerProfile.name)
    private trainerModel: Model<TrainerProfileDocument>,
    @InjectModel(ClientProfile.name)
    private clientModel: Model<ClientProfileDocument>,
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
}

