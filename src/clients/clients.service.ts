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

  /**
   * Helper method to get active plan from planHistory based on current date
   */
  private getActivePlanFromHistory(profile: ClientProfile): {
    planId: Types.ObjectId;
    planStartDate: Date;
    planEndDate: Date;
    assignedAt: Date;
    trainerId: Types.ObjectId;
  } | null {
    console.log('[ClientsService.getActivePlanFromHistory] START');
    
    if (!profile.planHistory || profile.planHistory.length === 0) {
      console.log('[ClientsService.getActivePlanFromHistory] ✗ No planHistory');
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('[ClientsService.getActivePlanFromHistory] → Today:', today);
    console.log('[ClientsService.getActivePlanFromHistory] → Checking ${profile.planHistory.length} plan entries...');

    // Find plan where planStartDate <= today <= planEndDate
    const activePlan = profile.planHistory.find((planEntry) => {
      const start = new Date(planEntry.planStartDate);
      const end = new Date(planEntry.planEndDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      const isActive = start <= today && end >= today;
      const planId = (planEntry.planId as any)?._id?.toString() || planEntry.planId.toString();
      
      console.log('[ClientsService.getActivePlanFromHistory] → Plan:', planId);
      console.log('[ClientsService.getActivePlanFromHistory]   - Start:', start);
      console.log('[ClientsService.getActivePlanFromHistory]   - End:', end);
      console.log('[ClientsService.getActivePlanFromHistory]   - Is active:', isActive);
      
      return isActive;
    });

    if (activePlan) {
      const planId = (activePlan.planId as any)?._id?.toString() || activePlan.planId.toString();
      console.log('[ClientsService.getActivePlanFromHistory] ✓ Active plan found:', planId);
    } else {
      console.log('[ClientsService.getActivePlanFromHistory] ✗ No active plan found');
    }

    return activePlan || null;
  }

  /**
   * Helper method to migrate currentPlanId to planHistory for backward compatibility
   */
  private async migrateCurrentPlanToHistory(
    profile: ClientProfile,
  ): Promise<void> {
    // Only migrate if currentPlanId exists but not in planHistory
    if (!profile.currentPlanId) {
      return;
    }

    const planId = (profile.currentPlanId as any)?._id?.toString() || 
                   profile.currentPlanId.toString();

    // Check if this plan already exists in planHistory
    const existingInHistory = profile.planHistory?.some((entry) => {
      const entryPlanId = (entry.planId as any)?._id?.toString() || 
                         entry.planId.toString();
      return entryPlanId === planId;
    });

    if (existingInHistory) {
      return; // Already in history, no need to migrate
    }

    // Migrate currentPlanId to planHistory
    if (!profile.trainerId) {
      const profileId = (profile as any)._id?.toString() || profile.userId?.toString();
      console.warn(`[ClientsService] Cannot migrate plan for client ${profileId}: no trainerId`);
      return;
    }

    // Get profile _id - handle both document and plain object
    const profileId = (profile as any)._id || profile.userId;
    if (!profileId) {
      console.warn(`[ClientsService] Cannot migrate plan: no profile ID found`);
      return;
    }

    const historyEntry = {
      planId: profile.currentPlanId,
      planStartDate: profile.planStartDate || new Date(),
      planEndDate: profile.planEndDate || new Date(),
      assignedAt: new Date(),
      trainerId: profile.trainerId,
    };

    await this.clientModel.findByIdAndUpdate(profileId, {
      $push: { planHistory: historyEntry },
    }).exec();
  }

  async getCurrentPlan(userId: string): Promise<any> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[ClientsService] getCurrentPlan() START');
    console.log('[ClientsService] → User ID:', userId);
    
    const profile = await this.getProfile(userId);
    console.log('[ClientsService] → Profile found');
    console.log('[ClientsService] → planHistory length:', profile.planHistory?.length || 0);
    console.log('[ClientsService] → currentPlanId:', profile.currentPlanId ? 'exists' : 'null');
    
    // First, check planHistory for active plan
    if (profile.planHistory && profile.planHistory.length > 0) {
      console.log('[ClientsService] → Checking planHistory for active plan...');
      const activePlanEntry = this.getActivePlanFromHistory(profile);
      
      if (activePlanEntry) {
        console.log('[ClientsService] ✓ Active plan entry found in planHistory');
        console.log('[ClientsService] → Plan start date:', activePlanEntry.planStartDate);
        console.log('[ClientsService] → Plan end date:', activePlanEntry.planEndDate);
        
        const planId = (activePlanEntry.planId as any)?._id?.toString() || 
                      activePlanEntry.planId.toString();
        console.log('[ClientsService] → Fetching plan from PlansService, planId:', planId);
        
        const plan = await this.plansService.getPlanById(planId);
        
        if (plan) {
          console.log('[ClientsService] ✓ Plan retrieved:', plan.name);
        } else {
          console.log('[ClientsService] ✗ Plan not found in PlansService');
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        return plan;
      }
      
      // No active plan in history
      console.log('[ClientsService] ✗ No active plan in planHistory');
      console.log('[ClientsService] → Plan history exists but no active plan found');
    } else {
      console.log('[ClientsService] → No planHistory found');
    }

    // Backward compatibility: migrate currentPlanId to planHistory if it exists
    if (profile.currentPlanId) {
      console.log('[ClientsService] → Migrating currentPlanId to planHistory...');
      // Migrate to history first
      await this.migrateCurrentPlanToHistory(profile);
      
      // Reload profile to get updated planHistory
      const updatedProfile = await this.getProfile(userId);
      console.log('[ClientsService] → Profile reloaded, planHistory length:', updatedProfile.planHistory?.length || 0);
      
      // Check again if there's an active plan after migration
      if (updatedProfile.planHistory && updatedProfile.planHistory.length > 0) {
        const activePlanEntry = this.getActivePlanFromHistory(updatedProfile);
        
        if (activePlanEntry) {
          // Check if plan is still active by date
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const start = new Date(activePlanEntry.planStartDate);
          const end = new Date(activePlanEntry.planEndDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          
          console.log('[ClientsService] → Checking date range...');
          console.log('[ClientsService] → Today:', today);
          console.log('[ClientsService] → Start:', start);
          console.log('[ClientsService] → End:', end);
          console.log('[ClientsService] → Is active:', start <= today && end >= today);
          
          if (start <= today && end >= today) {
            const planId = (activePlanEntry.planId as any)?._id?.toString() || 
                          activePlanEntry.planId.toString();
            console.log('[ClientsService] → Fetching plan after migration, planId:', planId);
            const plan = await this.plansService.getPlanById(planId);
            console.log('═══════════════════════════════════════════════════════════');
            return plan;
          } else {
            console.log('[ClientsService] ✗ Plan date range is not active');
          }
        }
      }
    }

    // No active plan found
    console.log('[ClientsService] ✗✗✗ No active plan found');
    console.log('═══════════════════════════════════════════════════════════');
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
    const activePlanEntry = profile.planHistory && profile.planHistory.length > 0
      ? this.getActivePlanFromHistory(profile)
      : null;
    
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

