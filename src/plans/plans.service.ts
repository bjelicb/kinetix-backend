import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WeeklyPlan,
  WeeklyPlanDocument,
} from './schemas/weekly-plan.schema';
import { TrainerProfile, TrainerProfileDocument } from '../trainers/schemas/trainer-profile.schema';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { TrainersService } from '../trainers/trainers.service';

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(WeeklyPlan.name)
    private planModel: Model<WeeklyPlanDocument>,
    @InjectModel(TrainerProfile.name)
    private trainerModel: Model<TrainerProfileDocument>,
    @InjectModel(ClientProfile.name)
    private clientModel: Model<ClientProfileDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => ClientsService))
    private clientsService: ClientsService,
    @Inject(forwardRef(() => WorkoutsService))
    private workoutsService: WorkoutsService,
    private trainersService: TrainersService,
  ) {}

  async createPlan(userId: string, dto: CreatePlanDto): Promise<WeeklyPlan> {
    let trainerProfileId: Types.ObjectId;
    
    // If trainerId is provided (admin case), use it; otherwise use current user (trainer case)
    const targetUserId = dto.trainerId || userId;
    
    // Get trainer profile to get trainerProfileId
    const trainerProfile = await this.trainersService.getProfile(targetUserId);
    if (!trainerProfile) {
      throw new NotFoundException(`Trainer profile not found for user ${targetUserId}`);
    }
    trainerProfileId = (trainerProfile as any)._id;

    // Remove trainerId from dto before saving (it's not part of the plan schema)
    const { trainerId, ...planData } = dto;

    const plan = new this.planModel({
      trainerId: trainerProfileId,
      ...planData,
      isTemplate: dto.isTemplate !== undefined ? dto.isTemplate : true,
    });

    return plan.save();
  }

  async getPlans(userId: string): Promise<WeeklyPlan[]> {
    // Get trainer profile to get trainerProfileId
    const trainerProfile = await this.trainersService.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;

    return this.planModel
      .find({ trainerId: trainerProfileId })
      .select('trainerId name description difficulty workouts assignedClientIds isTemplate createdAt updatedAt')
      .populate('assignedClientIds', 'userId')
      .lean()
      .exec();
  }

  async getPlanById(planId: string): Promise<any> {
    console.log('[PlansService] getPlanById() START');
    console.log('[PlansService] → Plan ID:', planId);
    
    const plan = await this.planModel
      .findById(planId)
      .populate('trainerId', 'businessName userId')
      .populate('assignedClientIds', 'userId')
      .lean()
      .exec();

    if (!plan) {
      console.log('[PlansService] ✗ Plan not found');
      throw new NotFoundException('Plan not found');
    }

    console.log('[PlansService] ✓ Plan found in database');
    console.log('[PlansService] → Plan name:', (plan as any).name);
    console.log('[PlansService] → Plan updatedAt:', (plan as any).updatedAt);

    const planObj = plan as any;
    let trainerName = 'Unknown Trainer';
    let trainerEmail = '';

    if (planObj.trainerId) {
      // Get trainer profile ID (handle both populated and non-populated cases)
      const trainerProfileId = (planObj.trainerId as any)?._id || planObj.trainerId;
      
      // Get trainer profile
      const trainerProfile = await this.trainerModel
        .findById(trainerProfileId)
        .populate('userId', 'firstName lastName email')
        .lean()
        .exec();

      if (trainerProfile) {
        // Try to get user info from populated userId
        if (trainerProfile.userId) {
          const trainerUser = trainerProfile.userId as any;
          trainerName = `${trainerUser.firstName} ${trainerUser.lastName}`.trim();
          trainerEmail = trainerUser.email || '';
        } else {
          // Fallback: get user directly by userId
          const userId = (trainerProfile.userId as any)?._id || trainerProfile.userId;
          if (userId) {
            const user = await this.userModel.findById(userId).lean().exec();
            if (user) {
              trainerName = `${user.firstName} ${user.lastName}`.trim();
              trainerEmail = user.email || '';
            }
          }
        }
      }
    }

    const result = {
      ...planObj,
      trainerName,
      trainerEmail,
      _id: planObj._id.toString(),
    };
    
    console.log('[PlansService] ✓ Plan prepared with trainer info');
    console.log('[PlansService] → Trainer name:', trainerName);
    console.log('[PlansService] → Workouts count:', planObj.workouts?.length || 0);
    console.log('═══════════════════════════════════════════════════════════');
    
    return result;
  }

  async updatePlan(
    planId: string,
    userId: string,
    userRole: string,
    dto: UpdatePlanDto,
  ): Promise<WeeklyPlan> {
    console.log(`[PlansService] updatePlan called - planId: ${planId}, userId: ${userId}, role: ${userRole}`);
    
    // Get plan directly (not using getPlanById to avoid trainerName logic)
    const plan = await this.planModel
      .findById(planId)
      .populate('trainerId', 'userId')
      .exec();

    if (!plan) {
      console.log(`[PlansService] Plan not found: ${planId}`);
      throw new NotFoundException('Plan not found');
    }

    // If user is ADMIN, skip ownership check
    if (userRole !== 'ADMIN') {
      const planTrainerId = (plan.trainerId as any)?._id || plan.trainerId;
      
      // Get trainer profile to get trainerProfileId
      const trainerProfile = await this.trainersService.getProfile(userId);
      const trainerProfileId = (trainerProfile as any)._id;
      
      console.log(`[PlansService] Plan trainerId: ${planTrainerId}, Current user trainerProfileId: ${trainerProfileId}`);
      
      if (planTrainerId.toString() !== trainerProfileId.toString()) {
        console.log(`[PlansService] Forbidden: Plan trainerId doesn't match current user`);
        throw new ForbiddenException('You can only update your own plans');
      }
    } else {
      console.log(`[PlansService] User is ADMIN, skipping ownership check`);
    }

    console.log(`[PlansService] Updating plan: ${planId} with data:`, dto);
    const updatedPlan = await this.planModel
      .findByIdAndUpdate(planId, { $set: dto }, { new: true })
      .exec();

    if (!updatedPlan) {
      console.log(`[PlansService] Plan not found after update: ${planId}`);
      throw new NotFoundException('Plan not found');
    }

    console.log(`[PlansService] Plan updated successfully: ${planId}`);
    return updatedPlan;
  }

  async deletePlan(planId: string, userId: string, userRole: string): Promise<void> {
    console.log(`[PlansService] deletePlan called - planId: ${planId}, userId: ${userId}, role: ${userRole}`);
    
    // Get plan directly (not using getPlanById to avoid trainerName logic)
    const plan = await this.planModel
      .findById(planId)
      .populate('trainerId', 'userId')
      .exec();

    if (!plan) {
      console.log(`[PlansService] Plan not found: ${planId}`);
      throw new NotFoundException('Plan not found');
    }

    // If user is ADMIN, skip ownership check
    if (userRole !== 'ADMIN') {
      const planTrainerId = (plan.trainerId as any)?._id || plan.trainerId;
      
      // Get trainer profile to get trainerProfileId
      const trainerProfile = await this.trainersService.getProfile(userId);
      const trainerProfileId = (trainerProfile as any)._id;
      
      console.log(`[PlansService] Plan trainerId: ${planTrainerId}, Current user trainerProfileId: ${trainerProfileId}`);
      
      if (planTrainerId.toString() !== trainerProfileId.toString()) {
        console.log(`[PlansService] Forbidden: Plan trainerId doesn't match current user`);
        throw new ForbiddenException('You can only delete your own plans');
      }
    } else {
      console.log(`[PlansService] User is ADMIN, skipping ownership check`);
    }

    console.log(`[PlansService] Deleting plan: ${planId}`);
    await this.planModel.findByIdAndDelete(planId).exec();
    console.log(`[PlansService] Plan deleted successfully`);
  }

  async assignPlanToClients(
    planId: string,
    userId: string,
    userRole: string,
    dto: AssignPlanDto,
  ): Promise<any> {
    console.log(`[PlansService] assignPlanToClients called - planId: ${planId}, userId: ${userId}, role: ${userRole}, clientIds: ${dto.clientIds.length}, startDate: ${dto.startDate}`);
    
    // Get plan directly (not using getPlanById to avoid trainerName logic)
    const plan = await this.planModel
      .findById(planId)
      .populate('trainerId', 'userId')
      .exec();

    if (!plan) {
      console.log(`[PlansService] Plan not found: ${planId}`);
      throw new NotFoundException('Plan not found');
    }

    const planTrainerId = (plan.trainerId as any)?._id || plan.trainerId;
    
    // If user is ADMIN, skip ownership check
    if (userRole !== 'ADMIN') {
      // Get trainer profile to get trainerProfileId
      const trainerProfile = await this.trainersService.getProfile(userId);
      const trainerProfileId = (trainerProfile as any)._id;
      
      console.log(`[PlansService] Plan trainerId: ${planTrainerId}, Current user trainerProfileId: ${trainerProfileId}`);
      
      if (planTrainerId.toString() !== trainerProfileId.toString()) {
        console.log(`[PlansService] Forbidden: Plan trainerId doesn't match current user`);
        throw new ForbiddenException('You can only assign your own plans');
      }
    } else {
      console.log(`[PlansService] User is ADMIN, skipping ownership check`);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7); // 7 days cycle

    console.log(`[PlansService] Start date: ${startDate.toISOString()}, End date: ${endDate.toISOString()}`);

    // Convert clientIds (can be userId or clientProfileId) to clientProfileIds
    const clientProfileIds: Types.ObjectId[] = [];
    for (const clientId of dto.clientIds) {
      try {
        console.log(`[PlansService] Processing clientId: ${clientId}`);
        let clientProfileId: Types.ObjectId;
        let client;
        let clientUser;
        
        // Frontend may send either userId or clientProfileId
        // Try as userId first (most common case)
        try {
          client = await this.clientsService.getProfile(clientId);
          clientProfileId = (client as any)._id;
          console.log(`[PlansService] Found client profile: ${clientProfileId} for userId: ${clientId}`);
        } catch (error) {
          // Not found as userId, try as clientProfileId
          console.log(`[PlansService] Not found as userId ${clientId}, trying as clientProfileId`);
          try {
            client = await this.clientsService.getProfileById(clientId);
            clientProfileId = (client as any)._id;
            console.log(`[PlansService] Found client profile: ${clientProfileId} (as clientProfileId)`);
          } catch (e2) {
            // Not found as either, try to find user and create profile
            console.log(`[PlansService] Client profile not found for ${clientId} (as userId or clientProfileId), trying to create new profile`);
            
            // Try to find user by ID (assuming clientId is userId)
            clientUser = await this.userModel.findById(clientId).exec();
            
            if (!clientUser) {
              throw new NotFoundException(`Client user not found: ${clientId} (tried as userId and clientProfileId, user does not exist)`);
            }
            
            if (clientUser.role !== 'CLIENT') {
              throw new NotFoundException(`User is not a CLIENT: ${clientUser.role}`);
            }
            
            // Create client profile with trainer from plan (needed for workout logs)
            const newClientProfile = new this.clientModel({
              userId: clientUser._id,
              trainerId: planTrainerId, // Assign trainer from plan
            });
            await newClientProfile.save();
            clientProfileId = newClientProfile._id;
            console.log(`[PlansService] Created new client profile: ${clientProfileId} for userId: ${clientUser._id} with trainerId: ${planTrainerId}`);
          }
        }
        
        clientProfileIds.push(clientProfileId);
      } catch (error) {
        console.error(`[PlansService] Error processing clientId ${clientId}:`, error);
        throw error;
      }
    }

    console.log(`[PlansService] Converted to ${clientProfileIds.length} clientProfileIds`);

    console.log(`[PlansService] Updating ${clientProfileIds.length} client profiles`);
    
    // Separate clients who already have this plan from new clients
    const existingClients: Types.ObjectId[] = [];
    const newClients: Types.ObjectId[] = [];
    
    for (const clientProfileId of clientProfileIds) {
      const client = await this.clientsService.getProfileById(clientProfileId);
      
      // Check if plan already exists in planHistory (new way) or currentPlanId (backward compatibility)
      let planExists = false;
      
      // Check planHistory first
      if (client.planHistory && client.planHistory.length > 0) {
        planExists = client.planHistory.some((entry) => {
          const entryPlanId = (entry.planId as any)?._id?.toString() || entry.planId.toString();
          return entryPlanId === planId.toString();
        });
      }
      
      // If not in planHistory, check currentPlanId (backward compatibility)
      if (!planExists) {
        const existingPlanId = (client.currentPlanId as any)?._id?.toString() || (client.currentPlanId as any)?.toString();
        if (existingPlanId && existingPlanId.toString() === planId.toString()) {
          planExists = true;
        }
      }
      
      if (planExists) {
        existingClients.push(clientProfileId);
        console.log(`[PlansService] Client ${clientProfileId} already has this plan assigned - preserving existing dates`);
      } else {
        newClients.push(clientProfileId);
        console.log(`[PlansService] Client ${clientProfileId} is new or has different plan - will assign with new dates`);
      }
    }
    
    console.log(`[PlansService] Found ${existingClients.length} existing clients and ${newClients.length} new clients`);
    
    // Update only new clients (don't touch existing clients' dates)
    for (const clientProfileId of newClients) {
      try {
        // Get client profile
        const client = await this.clientsService.getProfileById(clientProfileId);
        // Extract clientUserId - handle both populated and non-populated cases
        const clientUserId = (client.userId as any)?._id?.toString() || (client.userId as any)?.toString() || (client.userId as any).toString();
        console.log(`[PlansService] Updating NEW client profile ${clientProfileId} (userId: ${clientUserId})`);
        
        // Trainer validation and assignment logic
        let finalTrainerId = planTrainerId;
        if (!client.trainerId) {
          // Client doesn't have a trainer - assign trainer from plan
          console.log(`[PlansService] Client ${clientProfileId} doesn't have a trainer, assigning trainer from plan: ${planTrainerId}`);
        } else {
          // Client has a trainer - check if plan is from different trainer
          const clientTrainerId = (client.trainerId as any)?._id || client.trainerId;
          if (clientTrainerId.toString() !== planTrainerId.toString()) {
            // Plan is from different trainer - automatically change trainer
            // (because only one trainer can be active at a time)
            console.log(`[PlansService] Client ${clientProfileId} has trainer ${clientTrainerId}, but plan is from trainer ${planTrainerId}. Changing trainer to match plan.`);
            finalTrainerId = planTrainerId;
          } else {
            // Trainer matches - use existing trainer
            finalTrainerId = clientTrainerId;
          }
        }
        
        // Add plan to planHistory and update currentPlanId for backward compatibility
        const historyEntry = {
          planId: new Types.ObjectId(planId),
          planStartDate: startDate,
          planEndDate: endDate,
          assignedAt: new Date(),
          trainerId: finalTrainerId,
        };
        
        await this.clientModel.findByIdAndUpdate(clientProfileId, {
          $push: { planHistory: historyEntry },
          $set: {
            trainerId: finalTrainerId,
            // Keep currentPlanId for backward compatibility
            currentPlanId: new Types.ObjectId(planId),
            planStartDate: startDate,
            planEndDate: endDate,
          },
        }).exec();
        
        console.log(`[PlansService] Successfully updated NEW client profile ${clientProfileId} with plan in history and dates`);
      } catch (error) {
        console.error(`[PlansService] Error updating client profile ${clientProfileId}:`, error);
        throw error;
      }
    }
    
    // For existing clients, only ensure they're still in the plan's assignedClientIds (but don't touch their dates)
    // This is already handled by $addToSet below, so we just log it
    if (existingClients.length > 0) {
      console.log(`[PlansService] Skipping date updates for ${existingClients.length} existing clients - preserving their planStartDate and planEndDate`);
    }

    console.log(`[PlansService] Adding clients to plan's assignedClientIds`);
    // Add clients to plan's assignedClientIds
    await this.planModel.findByIdAndUpdate(planId, {
      $addToSet: { assignedClientIds: { $each: clientProfileIds } },
    }).exec();

    console.log(`[PlansService] Generating workout logs for NEW clients only`);
    // Auto-generate WorkoutLog placeholders for 7 days - ONLY for new clients
    // Existing clients already have their workout logs, don't regenerate
    // Get plan (not lean, needs to be Mongoose document for proper structure)
    const planForLogs = await this.planModel.findById(planId).exec();
    if (!planForLogs) {
      throw new NotFoundException('Plan not found');
    }
    
    // Only generate logs for new clients (not existing ones)
    for (const clientProfileId of newClients) {
      try {
        console.log(`[PlansService] Generating logs for NEW client ${clientProfileId}`);
        const client = await this.clientsService.getProfileById(clientProfileId);
        await this.workoutsService.generateWeeklyLogs(client, planForLogs as any, startDate);
        console.log(`[PlansService] Successfully generated logs for NEW client ${clientProfileId}`);
      } catch (error) {
        console.error(`[PlansService] Error generating logs for client ${clientProfileId}:`, error);
        throw error;
      }
    }
    
    if (existingClients.length > 0) {
      console.log(`[PlansService] Skipping workout log generation for ${existingClients.length} existing clients - they already have logs`);
    }

    console.log(`[PlansService] Plan assigned successfully to ${clientProfileIds.length} clients`);
    return {
      message: 'Plan assigned successfully',
      planId,
      clientIds: dto.clientIds,
      startDate,
      endDate,
    };
  }

  async duplicatePlan(planId: string, userId: string, userRole: string): Promise<WeeklyPlan> {
    console.log(`[PlansService] duplicatePlan called - planId: ${planId}, userId: ${userId}, role: ${userRole}`);
    
    // Get plan directly (not using getPlanById to avoid trainerName logic and get original trainerId)
    const originalPlan = await this.planModel
      .findById(planId)
      .lean()
      .exec();

    if (!originalPlan) {
      console.log(`[PlansService] Plan not found: ${planId}`);
      throw new NotFoundException('Plan not found');
    }

    const planObj = originalPlan as any;
    let trainerProfileId: Types.ObjectId;

    // If user is ADMIN, keep the original plan's trainerId
    // If user is TRAINER, use their own trainerProfileId
    if (userRole === 'ADMIN') {
      console.log(`[PlansService] User is ADMIN, keeping original plan's trainerId`);
      // trainerId from lean() query is already an ObjectId or string
      const originalTrainerId = planObj.trainerId;
      if (originalTrainerId instanceof Types.ObjectId) {
        trainerProfileId = originalTrainerId;
      } else {
        trainerProfileId = new Types.ObjectId(originalTrainerId);
      }
    } else {
      // Get trainer profile to get trainerProfileId
      const trainerProfile = await this.trainersService.getProfile(userId);
      trainerProfileId = (trainerProfile as any)._id;
      console.log(`[PlansService] User is TRAINER, using their trainerProfileId: ${trainerProfileId}`);
    }

    // Create new plan as template
    const duplicatedPlan = new this.planModel({
      trainerId: trainerProfileId,
      name: `${planObj.name} (Copy)`,
      description: planObj.description,
      difficulty: planObj.difficulty,
      workouts: planObj.workouts,
      isTemplate: true,
      assignedClientIds: [], // Reset assignments
    });

    console.log(`[PlansService] Creating duplicated plan with name: ${duplicatedPlan.name}`);
    const saved = await duplicatedPlan.save();
    console.log(`[PlansService] Plan duplicated successfully: ${saved._id}`);
    return saved;
  }
}

