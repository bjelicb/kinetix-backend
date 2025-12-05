import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ClientProfile,
  ClientProfileDocument,
} from './schemas/client-profile.schema';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(ClientProfile.name)
    private clientModel: Model<ClientProfileDocument>,
    @Inject(forwardRef(() => PlansService))
    private plansService: PlansService,
  ) {}

  async createProfile(
    userId: string,
    trainerId: string,
    dto: CreateClientDto,
  ): Promise<ClientProfile> {
    const clientProfile = new this.clientModel({
      userId: new Types.ObjectId(userId),
      trainerId: new Types.ObjectId(trainerId),
      ...dto,
    });

    return clientProfile.save();
  }

  async getProfile(userId: string): Promise<ClientProfile> {
    const profile = await this.clientModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'email firstName lastName')
      .populate('trainerId', 'businessName')
      .populate('currentPlanId')
      .exec();

    if (!profile) {
      throw new NotFoundException('Client profile not found');
    }

    return profile;
  }

  async getProfileById(profileId: string | Types.ObjectId): Promise<ClientProfile> {
    const profile = await this.clientModel
      .findById(profileId)
      .populate('userId', 'email firstName lastName')
      .populate('trainerId', 'businessName')
      .populate('currentPlanId')
      .exec();

    if (!profile) {
      throw new NotFoundException('Client profile not found');
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    dto: UpdateClientDto,
  ): Promise<ClientProfile> {
    const updateData: any = { ...dto };
    
    // Convert currentPlanId to ObjectId if provided
    if (dto.currentPlanId) {
      updateData.currentPlanId = new Types.ObjectId(dto.currentPlanId);
    }
    
    // Convert planStartDate and planEndDate to Date if provided
    if (dto.planStartDate) {
      updateData.planStartDate = new Date(dto.planStartDate);
    }
    if (dto.planEndDate) {
      updateData.planEndDate = new Date(dto.planEndDate);
    }
    
    const profile = await this.clientModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: updateData },
        { new: true },
      )
      .exec();

    if (!profile) {
      throw new NotFoundException('Client profile not found');
    }

    return profile;
  }

  async getCurrentPlan(userId: string): Promise<any> {
    const profile = await this.getProfile(userId);
    if (!profile.currentPlanId) {
      return null;
    }
    // Get the full plan details
    const planId = (profile.currentPlanId as any)?._id 
      ? (profile.currentPlanId as any)._id.toString() 
      : profile.currentPlanId.toString();
    return this.plansService.getPlanById(planId);
  }

  async getStats(userId: string): Promise<any> {
    const profile = await this.getProfile(userId);
    return {
      totalWorkoutsCompleted: profile.totalWorkoutsCompleted,
      currentStreak: profile.currentStreak,
      isPenaltyMode: profile.isPenaltyMode,
      consecutiveMissedWorkouts: profile.consecutiveMissedWorkouts,
    };
  }
}

