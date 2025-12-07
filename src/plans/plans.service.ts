import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WeeklyPlan,
  WeeklyPlanDocument,
} from './schemas/weekly-plan.schema';
import { TrainerProfile, TrainerProfileDocument } from '../trainers/schemas/trainer-profile.schema';
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
    const plan = await this.planModel
      .findById(planId)
      .populate('trainerId', 'businessName userId')
      .populate('assignedClientIds', 'userId')
      .lean()
      .exec();

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

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

    return {
      ...planObj,
      trainerName,
      trainerEmail,
      _id: planObj._id.toString(),
    };
  }

  async updatePlan(
    planId: string,
    userId: string,
    dto: UpdatePlanDto,
  ): Promise<WeeklyPlan> {
    // Get plan directly (not using getPlanById to avoid trainerName logic)
    const plan = await this.planModel
      .findById(planId)
      .populate('trainerId', 'userId')
      .exec();

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const planTrainerId = (plan.trainerId as any)?._id || plan.trainerId;
    
    // Get trainer profile to get trainerProfileId
    const trainerProfile = await this.trainersService.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;
    
    if (planTrainerId.toString() !== trainerProfileId.toString()) {
      throw new ForbiddenException('You can only update your own plans');
    }

    const updatedPlan = await this.planModel
      .findByIdAndUpdate(planId, { $set: dto }, { new: true })
      .exec();

    if (!updatedPlan) {
      throw new NotFoundException('Plan not found');
    }

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

    // Convert userIds to clientProfileIds
    const clientProfileIds: Types.ObjectId[] = [];
    for (const clientId of dto.clientIds) {
      try {
        console.log(`[PlansService] Processing clientId: ${clientId}`);
        // Try to get client profile by userId first (mobile sends userId)
        const client = await this.clientsService.getProfile(clientId);
        const clientProfileId = (client as any)._id;
        console.log(`[PlansService] Found client profile: ${clientProfileId} for userId: ${clientId}`);
        clientProfileIds.push(clientProfileId);
      } catch (error) {
        console.log(`[PlansService] Error getting client by userId ${clientId}, trying as clientProfileId: ${error}`);
        // If not found by userId, try as clientProfileId
        try {
          const client = await this.clientsService.getProfileById(clientId);
          const clientProfileId = (client as any)._id;
          console.log(`[PlansService] Found client profile: ${clientProfileId} (as clientProfileId)`);
          clientProfileIds.push(clientProfileId);
        } catch (e) {
          console.error(`[PlansService] Client not found: ${clientId}`, e);
          throw new NotFoundException(`Client not found: ${clientId}`);
        }
      }
    }

    console.log(`[PlansService] Converted to ${clientProfileIds.length} clientProfileIds`);

    console.log(`[PlansService] Updating ${clientProfileIds.length} client profiles`);
    
    // Update each client's current plan
    for (const clientProfileId of clientProfileIds) {
      try {
        // Get client profile
        const client = await this.clientsService.getProfileById(clientProfileId);
        // Extract clientUserId - handle both populated and non-populated cases
        const clientUserId = (client.userId as any)?._id?.toString() || (client.userId as any)?.toString() || (client.userId as any).toString();
        console.log(`[PlansService] Updating client profile ${clientProfileId} (userId: ${clientUserId})`);
        // Update using clientUserId
        await this.clientsService.updateProfile(clientUserId, {
          currentPlanId: planId,
          planStartDate: startDate.toISOString(),
          planEndDate: endDate.toISOString(),
        });
        console.log(`[PlansService] Successfully updated client profile ${clientProfileId}`);
      } catch (error) {
        console.error(`[PlansService] Error updating client profile ${clientProfileId}:`, error);
        throw error;
      }
    }

    console.log(`[PlansService] Adding clients to plan's assignedClientIds`);
    // Add clients to plan's assignedClientIds
    await this.planModel.findByIdAndUpdate(planId, {
      $addToSet: { assignedClientIds: { $each: clientProfileIds } },
    }).exec();

    console.log(`[PlansService] Generating workout logs`);
    // Auto-generate WorkoutLog placeholders for 7 days
    // Get plan (not lean, needs to be Mongoose document for proper structure)
    const planForLogs = await this.planModel.findById(planId).exec();
    if (!planForLogs) {
      throw new NotFoundException('Plan not found');
    }
    
    for (const clientProfileId of clientProfileIds) {
      try {
        console.log(`[PlansService] Generating logs for client ${clientProfileId}`);
        const client = await this.clientsService.getProfileById(clientProfileId);
        await this.workoutsService.generateWeeklyLogs(client, planForLogs as any, startDate);
        console.log(`[PlansService] Successfully generated logs for client ${clientProfileId}`);
      } catch (error) {
        console.error(`[PlansService] Error generating logs for client ${clientProfileId}:`, error);
        throw error;
      }
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

