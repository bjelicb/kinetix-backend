import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WeeklyPlan,
  WeeklyPlanDocument,
} from './schemas/weekly-plan.schema';
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
    @Inject(forwardRef(() => ClientsService))
    private clientsService: ClientsService,
    @Inject(forwardRef(() => WorkoutsService))
    private workoutsService: WorkoutsService,
    private trainersService: TrainersService,
  ) {}

  async createPlan(userId: string, dto: CreatePlanDto): Promise<WeeklyPlan> {
    // Get trainer profile to get trainerProfileId
    const trainerProfile = await this.trainersService.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;

    const plan = new this.planModel({
      trainerId: trainerProfileId,
      ...dto,
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

  async getPlanById(planId: string): Promise<WeeklyPlan> {
    const plan = await this.planModel
      .findById(planId)
      .populate('trainerId', 'businessName')
      .populate('assignedClientIds', 'userId')
      .exec();

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }

  async updatePlan(
    planId: string,
    userId: string,
    dto: UpdatePlanDto,
  ): Promise<WeeklyPlan> {
    // Verify ownership
    const plan = await this.getPlanById(planId);
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

  async deletePlan(planId: string, userId: string): Promise<void> {
    // Verify ownership
    const plan = await this.getPlanById(planId);
    const planTrainerId = (plan.trainerId as any)?._id || plan.trainerId;
    
    // Get trainer profile to get trainerProfileId
    const trainerProfile = await this.trainersService.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;
    
    if (planTrainerId.toString() !== trainerProfileId.toString()) {
      throw new ForbiddenException('You can only delete your own plans');
    }

    await this.planModel.findByIdAndDelete(planId).exec();
  }

  async assignPlanToClients(
    planId: string,
    userId: string,
    dto: AssignPlanDto,
  ): Promise<any> {
    // Verify ownership
    const plan = await this.getPlanById(planId);
    const planTrainerId = (plan.trainerId as any)?._id || plan.trainerId;
    
    // Get trainer profile to get trainerProfileId
    const trainerProfile = await this.trainersService.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;
    
    if (planTrainerId.toString() !== trainerProfileId.toString()) {
      throw new ForbiddenException('You can only assign your own plans');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7); // 7 days cycle

    // Update each client's current plan
    for (const clientProfileId of dto.clientIds) {
      // Get client profile by profileId (not userId)
      const client = await this.clientsService.getProfileById(clientProfileId);
      // Extract clientUserId - handle both populated and non-populated cases
      const clientUserId = (client.userId as any)?._id?.toString() || (client.userId as any)?.toString() || (client.userId as any).toString();
      // Update using clientUserId
      await this.clientsService.updateProfile(clientUserId, {
        currentPlanId: planId,
        planStartDate: startDate.toISOString(),
        planEndDate: endDate.toISOString(),
      });
    }

    // Add clients to plan's assignedClientIds
    await this.planModel.findByIdAndUpdate(planId, {
      $addToSet: { assignedClientIds: { $each: dto.clientIds.map(id => new Types.ObjectId(id)) } },
    }).exec();

    // Auto-generate WorkoutLog placeholders for 7 days
    // Get plan (not lean, needs to be Mongoose document for proper structure)
    const planForLogs = await this.planModel.findById(planId).exec();
    if (!planForLogs) {
      throw new NotFoundException('Plan not found');
    }
    
    for (const clientProfileId of dto.clientIds) {
      try {
        const client = await this.clientsService.getProfileById(clientProfileId);
        await this.workoutsService.generateWeeklyLogs(client, planForLogs as any, startDate);
      } catch (error) {
        console.error(`Error generating logs for client ${clientProfileId}:`, error);
        throw error;
      }
    }

    return {
      message: 'Plan assigned successfully',
      planId,
      clientIds: dto.clientIds,
      startDate,
      endDate,
    };
  }

  async duplicatePlan(planId: string, userId: string): Promise<WeeklyPlan> {
    const originalPlan = await this.getPlanById(planId);

    // Get trainer profile to get trainerProfileId
    const trainerProfile = await this.trainersService.getProfile(userId);
    const trainerProfileId = (trainerProfile as any)._id;

    // Create new plan as template
    const duplicatedPlan = new this.planModel({
      trainerId: trainerProfileId,
      name: `${originalPlan.name} (Copy)`,
      description: originalPlan.description,
      difficulty: originalPlan.difficulty,
      workouts: originalPlan.workouts,
      isTemplate: true,
      assignedClientIds: [], // Reset assignments
    });

    return duplicatedPlan.save();
  }
}

