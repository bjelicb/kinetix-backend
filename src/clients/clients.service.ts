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
    private readonly clientModel: Model<ClientProfileDocument>,
    @Inject(forwardRef(() => PlansService))
    private readonly plansService: PlansService,
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

  async getProfile(userId: string): Promise<any> {
    const profile = await this.clientModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'email firstName lastName')
      .populate('trainerId', 'businessName')
      .populate('currentPlanId')
      .exec();

    if (!profile) {
      throw new NotFoundException('Client profile not found');
    }

    // Transform to plain object and extract currentPlanId as string
    const profileObj = profile.toObject();
    
    return {
      ...profileObj,
      currentPlanId: this.extractObjectIdAsString(profileObj.currentPlanId),
    };
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
   * Reusable utility to extract ObjectId as string
   * Handles populated objects, ObjectId instances, and strings
   */
  private extractObjectIdAsString(field: any): string | null {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (field._id) return field._id.toString();
    if (field.toString && typeof field.toString === 'function') {
      try {
        const str = field.toString();
        return str === '[object Object]' ? null : str;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Helper method to get current unlocked plan entry from currentPlanId
   * This is the ONE SOURCE OF TRUTH for which plan is active/unlocked
   * 
   * Logic: currentPlanId points to the plan that client has UNLOCKED and PAID for
   * All workout logs AFTER this plan are LOCKED until client unlocks next week
   */
  getActivePlanEntry(profile: ClientProfile): {
    planId: Types.ObjectId;
    planStartDate: Date;
    planEndDate: Date;
    assignedAt: Date;
    trainerId: Types.ObjectId;
  } | null {
    // No currentPlanId = no unlocked plan
    if (!profile.currentPlanId) {
      return null;
    }

    // Find the plan in planHistory that matches currentPlanId
    if (!profile.planHistory || profile.planHistory.length === 0) {
      return null;
    }

    // Extract ID from currentPlanId (might be populated or just ObjectId)
    const currentPlanIdStr = (profile.currentPlanId as any)?._id?.toString() || profile.currentPlanId.toString();
    
    const activePlan = profile.planHistory.find((planEntry) => {
      const entryPlanId = (planEntry.planId as any)?._id?.toString() || planEntry.planId.toString();
      return entryPlanId === currentPlanIdStr;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 1. Current Plan (unlocked) - BUT verify it's not in the past
    if (profile.currentPlanId) {
      const planId = this.extractObjectIdAsString(profile.currentPlanId);
      if (planId) {
        // Check if this plan exists in planHistory and if it's completed
        let planInHistory: { planId: any; planStartDate: Date; planEndDate: Date; assignedAt: Date; trainerId: any } | undefined = undefined;
        if (profile.planHistory && profile.planHistory.length > 0) {
          planInHistory = (profile.planHistory as Array<{ planId: any; planStartDate: Date; planEndDate: Date; assignedAt: Date; trainerId: any }>).find(entry => {
            const entryPlanId = this.extractObjectIdAsString(entry.planId);
            return entryPlanId === planId;
          });
        }
        
        // If plan is not in history, it's invalid - clear currentPlanId
        if (!planInHistory) {
          // Clear invalid currentPlanId
          await this.clientModel.updateOne(
            { _id: new Types.ObjectId(profile._id) },
            { $set: { currentPlanId: null } }
          ).exec();
          // Continue to check for future/previous plans below
        } else {
          // Plan is in history - check if it's completed (in the past)
          const planEndDate = new Date(planInHistory.planEndDate);
          planEndDate.setHours(23, 59, 59, 999);
          const isCompleted = planEndDate < today;
          
          // If plan is completed, clear currentPlanId and treat it as previous
          if (isCompleted) {
            // Clear currentPlanId since it points to a completed plan
            await this.clientModel.updateOne(
              { _id: new Types.ObjectId(profile._id) },
              { $set: { currentPlanId: null } }
            ).exec();
            
            // Return as previous plan
            const plan = await this.plansService.getPlanById(planId, userId, 'CLIENT');
            if (plan) {
              return { ...plan, isFromHistory: true, planStatus: 'previous' };
            }
          } else {
            // Plan is not completed - return as current
            const plan = await this.plansService.getPlanById(planId, userId, 'CLIENT');
            if (plan) {
              // Return plan with flag indicating it's the current (unlocked) plan
              return { ...plan, isFromHistory: false, planStatus: 'current' };
            }
          }
        }
      }
    }
    
    // 2. Find Future Plan (not unlocked yet)
    if (profile.planHistory && profile.planHistory.length > 0) {
      // Sort by planStartDate ascending to find next plan
      const sortedPlans = [...profile.planHistory].sort((a, b) => 
        new Date(a.planStartDate).getTime() - new Date(b.planStartDate).getTime()
      );
      
      // Find first plan that ends today or in future
      const futurePlan = sortedPlans.find(entry => {
        const planEndDate = new Date(entry.planEndDate);
        planEndDate.setHours(23, 59, 59, 999);
        return planEndDate >= today;
      });
      
      if (futurePlan) {
        const planId = this.extractObjectIdAsString(futurePlan.planId);
        if (planId) {
          const plan = await this.plansService.getPlanById(planId, userId, 'CLIENT');
          if (plan) {
            // Return plan with flag indicating it's from history (future plan, not unlocked)
            return { ...plan, isFromHistory: true, planStatus: 'future' };
          }
        }
      }
      
      // 3. Find Previous Plan (completed)
      // Sort by planEndDate descending to find most recent completed
      const sortedByEndDate = [...profile.planHistory].sort((a, b) => 
        new Date(b.planEndDate).getTime() - new Date(a.planEndDate).getTime()
      );
      
      const previousPlan = sortedByEndDate.find(entry => {
        const planEndDate = new Date(entry.planEndDate);
        planEndDate.setHours(23, 59, 59, 999);
        return planEndDate < today;
      });
      
      if (previousPlan) {
        const planId = this.extractObjectIdAsString(previousPlan.planId);
        if (planId) {
          const plan = await this.plansService.getPlanById(planId, userId, 'CLIENT');
          if (plan) {
            // Return plan with flag indicating it's from history (previous plan, completed)
            return { ...plan, isFromHistory: true, planStatus: 'previous' };
          }
        }
      }
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
          const planDetails = await this.plansService.getPlanById(planId, userId, 'CLIENT');
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

