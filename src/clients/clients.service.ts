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
import { DateUtils } from '../common/utils/date.utils';

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

  /**
   * Helper method to get active plan entry from planHistory based on current date
   * Uses DateUtils for consistent UTC normalization
   */
  getActivePlanEntry(profile: ClientProfile): {
    planId: Types.ObjectId;
    planStartDate: Date;
    planEndDate: Date;
    assignedAt: Date;
    trainerId: Types.ObjectId;
  } | null {
    if (!profile.planHistory || profile.planHistory.length === 0) {
      return null;
    }

    const today = DateUtils.normalizeToStartOfDay(new Date());

    // Find plan where planStartDate <= today <= planEndDate
    const activePlan = profile.planHistory.find((planEntry) => {
      const start = DateUtils.normalizeToStartOfDay(new Date(planEntry.planStartDate));
      const end = DateUtils.normalizeToEndOfDay(new Date(planEntry.planEndDate));
      return start <= today && end >= today;
    });

    return activePlan || null;
  }

  /**
   * Helper method to check if client has a specific plan in planHistory
   */
  async hasPlanInHistory(clientProfileId: string, planId: string): Promise<boolean> {
    const profile = await this.getProfileById(clientProfileId);
    
    if (!profile.planHistory || profile.planHistory.length === 0) {
      return false;
    }

    return profile.planHistory.some((entry) => {
      const entryPlanId = (entry.planId as any)?._id?.toString() || entry.planId.toString();
      return entryPlanId === planId.toString();
    });
  }

  /**
   * Helper method to get active plan from planHistory based on current date
   * @deprecated Use getActivePlanEntry instead
   */
  private getActivePlanFromHistory(profile: ClientProfile): {
    planId: Types.ObjectId;
    planStartDate: Date;
    planEndDate: Date;
    assignedAt: Date;
    trainerId: Types.ObjectId;
  } | null {
    return this.getActivePlanEntry(profile);
  }


  async getCurrentPlan(userId: string): Promise<any> {
    const profile = await this.getProfile(userId);
    
    // Check planHistory for active plan
    const activePlanEntry = this.getActivePlanEntry(profile);
    
    if (activePlanEntry) {
      const planId = (activePlanEntry.planId as any)?._id?.toString() || 
                    activePlanEntry.planId.toString();
      return await this.plansService.getPlanById(planId);
    }

    return null;
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

  async getPlanHistory(userId: string): Promise<any> {
    const profile = await this.getProfile(userId);
    
    // Get active plan entry
    const activePlanEntry = this.getActivePlanEntry(profile);
    
    const activePlanId = activePlanEntry
      ? ((activePlanEntry.planId as any)?._id?.toString() || activePlanEntry.planId.toString())
      : null;
    
    // Map planHistory to include full plan details and mark active plan
    const planHistoryWithDetails = await Promise.all(
      (profile.planHistory || []).map(async (entry) => {
        const planId = (entry.planId as any)?._id?.toString() || entry.planId.toString();
        const isActive = activePlanId === planId;
        
        try {
          const planDetails = await this.plansService.getPlanById(planId);
          return {
            ...entry,
            planId: planId,
            planDetails,
            isActive,
            planStartDate: entry.planStartDate,
            planEndDate: entry.planEndDate,
            assignedAt: entry.assignedAt,
            trainerId: (entry.trainerId as any)?._id?.toString() || entry.trainerId.toString(),
          };
        } catch (error) {
          // Plan might be deleted, return entry without details
          return {
            ...entry,
            planId: planId,
            planDetails: null,
            isActive,
            planStartDate: entry.planStartDate,
            planEndDate: entry.planEndDate,
            assignedAt: entry.assignedAt,
            trainerId: (entry.trainerId as any)?._id?.toString() || entry.trainerId.toString(),
          };
        }
      })
    );
    
    // Sort by assignedAt descending (newest first)
    planHistoryWithDetails.sort((a, b) => {
      const dateA = new Date(a.assignedAt).getTime();
      const dateB = new Date(b.assignedAt).getTime();
      return dateB - dateA;
    });
    
    return {
      planHistory: planHistoryWithDetails,
      activePlan: activePlanEntry ? planHistoryWithDetails.find(p => p.isActive) : null,
    };
  }
}

