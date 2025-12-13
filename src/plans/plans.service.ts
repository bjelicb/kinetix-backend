import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WeeklyPlan,
  WeeklyPlanDocument,
} from './schemas/weekly-plan.schema';
import { TrainerProfile, TrainerProfileDocument } from '../trainers/schemas/trainer-profile.schema';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { WorkoutLog, WorkoutLogDocument } from '../workouts/schemas/workout-log.schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { TrainersService } from '../trainers/trainers.service';
import { GamificationService } from '../gamification/gamification.service';
import { AppLogger } from '../common/utils/logger.utils';
import { PlanOverlapHandler } from '../common/utils/plan-overlap-handler';
import { DateUtils } from '../common/utils/date.utils';
import { PlanValidators } from '../common/utils/plan-validators';

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
    @InjectModel(WorkoutLog.name)
    private workoutLogModel: Model<WorkoutLogDocument>,
    @Inject(forwardRef(() => ClientsService))
    private clientsService: ClientsService,
    @Inject(forwardRef(() => WorkoutsService))
    private workoutsService: WorkoutsService,
    private trainersService: TrainersService,
    @Inject(forwardRef(() => GamificationService))
    private gamificationService: GamificationService,
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
      .find({ 
        trainerId: trainerProfileId,
        isDeleted: { $ne: true } // Filter out soft deleted plans
      })
      .select('trainerId name description difficulty workouts assignedClientIds isTemplate createdAt updatedAt')
      .populate('assignedClientIds', 'userId')
      .lean()
      .exec();
  }

  async getPlanById(planId: string): Promise<any> {
    console.log('[PlansService] getPlanById() START');
    console.log('[PlansService] → Plan ID:', planId);
    
    const plan = await this.planModel
      .findOne({ 
        _id: planId,
        isDeleted: { $ne: true } // Filter out soft deleted plans
      })
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
    console.log('[PlansService] → Raw trainerId from DB:', planObj.trainerId);
    console.log('[PlansService] → trainerId type:', typeof planObj.trainerId);
    let trainerName = 'Unknown Trainer';
    let trainerEmail = '';
    let trainerUserId: string | null = null;
    let trainerProfileId: string | null = null;

    if (planObj.trainerId) {
      // Get trainer profile ID (handle both populated and non-populated cases)
      trainerProfileId = (planObj.trainerId as any)?._id?.toString() || (planObj.trainerId as any)?.toString() || null;
      
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
          // Extract User ID (this is what frontend needs to match with User.id)
          trainerUserId = trainerUser._id?.toString() || null;
        } else {
          // Fallback: get user directly by userId
          const userId = (trainerProfile.userId as any)?._id || trainerProfile.userId;
          if (userId) {
            const user = await this.userModel.findById(userId).lean().exec();
            if (user) {
              trainerName = `${user.firstName} ${user.lastName}`.trim();
              trainerEmail = user.email || '';
              trainerUserId = (user._id as any)?.toString() || null;
            }
          }
        }
      }
    }

    const result = {
      ...planObj,
      trainerId: trainerUserId, // ✅ Vraća User ID (matches User.id in frontend)
      trainerProfileId: trainerProfileId, // ✅ TrainerProfile ID (for info)
      trainerName,
      trainerEmail,
      _id: planObj._id.toString(),
    };
    
    console.log('[PlansService] ✓ Plan prepared with trainer info');
    console.log('[PlansService] → Trainer name:', trainerName);
    console.log('[PlansService] → Trainer User ID:', trainerUserId);
    console.log('[PlansService] → Trainer Profile ID:', trainerProfileId);
    console.log('[PlansService] → Workouts count:', planObj.workouts?.length || 0);
    console.log('[PlansService] → Final trainerId being returned:', result.trainerId);
    console.log('[PlansService] → Final trainerId type:', typeof result.trainerId);
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

    // Validate template status if plan has assigned clients
    if (plan.assignedClientIds && plan.assignedClientIds.length > 0) {
      PlanValidators.validateIsTemplate(plan, 'update');
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
    
    // Handle trainerId conversion (user ID → trainer profile ID)
    let trainerProfileId: Types.ObjectId | undefined;
    if (dto.trainerId) {
      // Get trainer profile to get trainerProfileId (same logic as createPlan)
      const trainerProfile = await this.trainersService.getProfile(dto.trainerId);
      if (!trainerProfile) {
        throw new NotFoundException(`Trainer profile not found for user ${dto.trainerId}`);
      }
      trainerProfileId = (trainerProfile as any)._id;
      console.log(`[PlansService] Converted trainerId: ${dto.trainerId} → ${trainerProfileId}`);
    }
    
    // Build update object - use explicit ObjectId for trainerId, not $set spread
    const updateFields: any = {};
    if (dto.name !== undefined) updateFields.name = dto.name;
    if (dto.description !== undefined) updateFields.description = dto.description;
    if (dto.difficulty !== undefined) updateFields.difficulty = dto.difficulty;
    if (dto.workouts !== undefined) updateFields.workouts = dto.workouts;
    if (dto.isTemplate !== undefined) updateFields.isTemplate = dto.isTemplate;
    if (dto.weeklyCost !== undefined) updateFields.weeklyCost = dto.weeklyCost;
    if (trainerProfileId !== undefined) {
      updateFields.trainerId = new Types.ObjectId(trainerProfileId);
      console.log(`[PlansService] Setting trainerId as ObjectId: ${updateFields.trainerId}`);
    }
    
    console.log(`[PlansService] Update fields:`, Object.keys(updateFields));
    
    const updatedPlan = await this.planModel
      .findByIdAndUpdate(planId, updateFields, { new: true })
      .exec();

    if (!updatedPlan) {
      console.log(`[PlansService] Plan not found after update: ${planId}`);
      throw new NotFoundException('Plan not found');
    }

    console.log(`[PlansService] Plan updated successfully: ${planId}`);
    console.log(`[PlansService] ✓ Verified trainerId in updated plan: ${updatedPlan.trainerId}`);
    console.log(`[PlansService] ✓ Verified trainerId type: ${typeof updatedPlan.trainerId}`);
    return updatedPlan;
  }

  async deletePlan(planId: string, userId: string, userRole: string): Promise<void> {
    AppLogger.logStart('PLAN_DELETE', { planId, userId, userRole });
    
    try {
      // Get plan directly (not using getPlanById to avoid trainerName logic)
      const plan = await this.planModel
        .findById(planId)
        .populate('trainerId', 'userId')
        .exec();

      if (!plan) {
        AppLogger.logError('PLAN_DELETE', { planId, reason: 'Plan not found' });
        throw new NotFoundException('Plan not found');
      }

      // Validate that plan is a template (only templates can be deleted fully)
      // Note: This is a soft validation - we still allow delete but will soft-delete if needed
      if (plan.assignedClientIds && plan.assignedClientIds.length > 0) {
        AppLogger.logOperation('PLAN_DELETE', {
          planId,
          note: 'Plan has assigned clients - will use soft delete',
        }, 'debug');
      }

      // If user is ADMIN, skip ownership check
      if (userRole !== 'ADMIN') {
        const planTrainerId = (plan.trainerId as any)?._id || plan.trainerId;
        
        // Get trainer profile to get trainerProfileId
        const trainerProfile = await this.trainersService.getProfile(userId);
        const trainerProfileId = (trainerProfile as any)._id;
        
        if (planTrainerId.toString() !== trainerProfileId.toString()) {
          AppLogger.logError('PLAN_DELETE', { 
            planId, 
            reason: 'Ownership validation failed',
            planTrainerId: planTrainerId.toString(),
            userTrainerId: trainerProfileId.toString()
          });
          throw new ForbiddenException('You can only delete your own plans');
        }
      }

      // Check for active workout logs (future dates)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const activeLogsCount = await this.workoutLogModel.countDocuments({
        weeklyPlanId: new Types.ObjectId(planId),
        workoutDate: { $gte: today },
      }).exec();

      AppLogger.logOperation('PLAN_DELETE_CHECK', {
        planId,
        activeLogsCount,
        checkType: 'future_workout_logs'
      }, 'debug');

      // Check for assigned clients
      const assignedClientsCount = plan.assignedClientIds?.length || 0;

      AppLogger.logOperation('PLAN_DELETE_CHECK_CLIENTS', {
        planId,
        assignedClientsCount,
        checkType: 'assigned_clients'
      }, 'debug');

      // Determine if soft delete or hard delete
      if (activeLogsCount > 0 || assignedClientsCount > 0) {
        // Soft delete
        await this.planModel.findByIdAndUpdate(planId, {
          isDeleted: true,
          deletedAt: new Date(),
        }).exec();

        AppLogger.logWarning('PLAN_DELETE_SOFT', {
          planId,
          reason: 'Has active logs or assigned clients',
          activeLogsCount,
          assignedClientsCount,
          deletedAt: new Date().toISOString()
        });
      } else {
        // Hard delete
        await this.planModel.findByIdAndDelete(planId).exec();

        AppLogger.logOperation('PLAN_DELETE_HARD', {
          planId,
          reason: 'No active logs or assigned clients'
        }, 'info');
      }

      AppLogger.logComplete('PLAN_DELETE', { planId, userId });
    } catch (error) {
      AppLogger.logError('PLAN_DELETE', { planId, userId }, error);
      throw error;
    }
  }

  /**
   * Check if client can unlock next week
   * Returns true only if current week's workouts are ALL completed
   */
  async canUnlockNextWeek(clientId: string): Promise<boolean> {
    const client = await this.clientsService.getProfileById(clientId);
    
    // Get active plan from planHistory using helper method
    const activePlanEntry = this.clientsService.getActivePlanEntry(client);
    
    if (!activePlanEntry) {
      // No active plan, can unlock (first week)
      return true;
    }
    
    // Check if current week has ended
    const now = DateUtils.normalizeToStartOfDay(new Date());
    const weekEnd = DateUtils.normalizeToEndOfDay(new Date(activePlanEntry.planEndDate));
    
    if (now > weekEnd) {
      // Week has ended, check if all workouts are completed
      const planId = (activePlanEntry.planId as any)?._id?.toString() || activePlanEntry.planId.toString();
      
      const workoutLogs = await this.workoutsService.getWorkoutLogsByClient(clientId);
      
      // Filter logs for this plan and week
      const planStartDate = DateUtils.normalizeToStartOfDay(new Date(activePlanEntry.planStartDate));
      const weekLogs = workoutLogs.filter(log => {
        const logPlanId = (log.weeklyPlanId as any)?._id?.toString() || log.weeklyPlanId.toString();
        const logDate = DateUtils.normalizeToStartOfDay(new Date(log.workoutDate));
        
        return logPlanId === planId &&
               logDate >= planStartDate &&
               logDate <= weekEnd;
      });
      
      // Get plan to check rest days
      const plan = await this.planModel.findById(planId).exec();
      if (!plan) {
        return false;
      }
      
      // Check if all non-rest-day workouts are completed
      const allCompleted = weekLogs.every(log => {
        // Find the workout day in plan
        const workoutDay = (plan.workouts || []).find((w: any) => w.dayOfWeek === log.dayOfWeek);
        
        // Rest days don't need to be completed
        if (workoutDay && workoutDay.isRestDay) {
          return true;
        }
        
        return log.isCompleted === true;
      });
      
      return allCompleted;
    }
    
    // Week hasn't ended yet, cannot unlock
    return false;
  }

  /**
   * Helper method to resolve clientId (can be userId or clientProfileId) to clientProfileId and client profile
   */
  private async resolveClientProfileId(clientId: string): Promise<{clientProfileId: string, client: ClientProfile} | null> {
    try {
      // Try as userId first
      const client = await this.clientsService.getProfile(clientId);
      const clientProfileId = (client as any)._id.toString();
      return { clientProfileId, client };
    } catch (e) {
      try {
        // Try as clientProfileId
        const client = await this.clientsService.getProfileById(clientId);
        const clientProfileId = (client as any)._id.toString();
        return { clientProfileId, client };
      } catch (e2) {
        // Client not found
        return null;
      }
    }
  }

  async assignPlanToClients(
    planId: string,
    userId: string,
    userRole: string,
    dto: AssignPlanDto,
  ): Promise<any> {
    // Validate that clients can unlock next week (if they have an active plan)
    // BUT: Allow assign if it's the same plan (re-assign)
    for (const clientId of dto.clientIds) {
      try {
        const resolved = await this.resolveClientProfileId(clientId);
        if (!resolved) {
          continue; // Skip unlock check for new clients
        }
        
        const { clientProfileId, client } = resolved;
        
        // Check if client already has this exact plan assigned
        const hasThisPlan = await this.clientsService.hasPlanInHistory(clientProfileId, planId);
        
        if (hasThisPlan) {
          continue; // Skip unlock check if it's the same plan
        }
        
        // Only check unlock if client has a different active plan
        const canUnlock = await this.canUnlockNextWeek(clientProfileId);
        if (!canUnlock) {
          throw new BadRequestException(
            `Client cannot be assigned a new plan. Current week must be completed first. Complete all workouts in the current week before assigning a new plan.`
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        // For other errors (e.g., client not found), continue (might be new client)
      }
    }
    
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

    // Parse startDate as UTC (append T00:00:00.000Z if date-only string to prevent timezone conversion)
    const dateString = dto.startDate.includes('T') ? dto.startDate : `${dto.startDate}T00:00:00.000Z`;
    const startDate = DateUtils.normalizeToStartOfDay(new Date(dateString));
    const endDate = DateUtils.addDays(startDate, 7); // 7 days cycle
    const normalizedEndDate = DateUtils.normalizeToEndOfDay(endDate);

    // Validate start date
    PlanValidators.validateStartDate(startDate, planId);


    // Convert clientIds (can be userId or clientProfileId) to clientProfileIds
    const clientProfileIds: Types.ObjectId[] = [];
    for (const clientId of dto.clientIds) {
      try {
        const resolved = await this.resolveClientProfileId(clientId);
        if (resolved) {
          clientProfileIds.push(new Types.ObjectId(resolved.clientProfileId));
        } else {
          // Not found, try to find user and create profile
          const clientUser = await this.userModel.findById(clientId).exec();
          
          if (!clientUser) {
            throw new NotFoundException(`Client user not found: ${clientId}`);
          }
          
          if (clientUser.role !== 'CLIENT') {
            throw new NotFoundException(`User is not a CLIENT: ${clientUser.role}`);
          }
          
          // Create client profile with trainer from plan (needed for workout logs)
          const newClientProfile = new this.clientModel({
            userId: clientUser._id,
            trainerId: planTrainerId,
          });
          await newClientProfile.save();
          clientProfileIds.push(newClientProfile._id);
        }
      } catch (error) {
        console.error(`[PlansService] Error processing clientId ${clientId}:`, error);
        throw error;
      }
    }
    
    // Separate clients who already have this plan from new clients
    const existingClients: Types.ObjectId[] = [];
    const newClients: Types.ObjectId[] = [];
    
    for (const clientProfileId of clientProfileIds) {
      const hasPlan = await this.clientsService.hasPlanInHistory(clientProfileId.toString(), planId);
      if (hasPlan) {
        existingClients.push(clientProfileId);
      } else {
        newClients.push(clientProfileId);
      }
    }
    
    // Update only new clients (don't touch existing clients' dates)
    for (const clientProfileId of newClients) {
      try {
        // Get client profile
        const client = await this.clientsService.getProfileById(clientProfileId);
        
        // Check for overlapping plans and automatically close them
        const newStartDate = DateUtils.normalizeToStartOfDay(startDate);
        const newEndDate = DateUtils.normalizeToEndOfDay(endDate);
        
        if (client.planHistory && client.planHistory.length > 0) {
          const overlappingPlan = PlanOverlapHandler.findOverlappingPlan(
            client.planHistory,
            planId,
            newStartDate,
            newEndDate,
          );
          
          if (overlappingPlan) {
            // Calculate close date (day before new plan starts)
            const closeDate = PlanOverlapHandler.calculateCloseDate(newStartDate);
            
            AppLogger.logWarning('PLAN_OVERLAP_CLOSE', {
              clientId: clientProfileId.toString(),
              oldPlanId: overlappingPlan.planId.toString(),
              newPlanId: planId,
              oldEndDate: overlappingPlan.planEndDate,
              newCloseDate: closeDate.toISOString(),
            });
            
            // Mark future workouts of the overlapping plan as missed
            await this.workoutsService.markMissedWorkoutsForPlan(
              clientProfileId.toString(),
              overlappingPlan.planId.toString(),
              closeDate
            );
            
            // Update the overlapping plan's end date in planHistory
            await this.clientModel.updateOne(
              { _id: clientProfileId, 'planHistory.planId': overlappingPlan.planId },
              { $set: { 'planHistory.$.planEndDate': closeDate } }
            ).exec();
          }
        }
        
        // Trainer validation and assignment logic
        let finalTrainerId = planTrainerId;
        if (client.trainerId) {
          const clientTrainerId = (client.trainerId as any)?._id || client.trainerId;
          if (clientTrainerId.toString() !== planTrainerId.toString()) {
            // Plan is from different trainer - automatically change trainer
            finalTrainerId = planTrainerId;
          } else {
            // Trainer matches - use existing trainer
            finalTrainerId = clientTrainerId;
          }
        }
        
        // Add plan to planHistory
        const historyEntry = {
          planId: new Types.ObjectId(planId),
          planStartDate: startDate,
          planEndDate: normalizedEndDate,
          assignedAt: new Date(),
          trainerId: finalTrainerId,
        };
        
        await this.clientModel.findByIdAndUpdate(clientProfileId, {
          $push: { planHistory: historyEntry },
          $set: {
            trainerId: finalTrainerId,
          },
        }).exec();
        
        // Add plan cost to client's running tab balance
        const planCost = (plan as any).weeklyCost || 0;
        if (planCost > 0) {
          try {
            await this.gamificationService.addPenaltyToBalance(
              clientProfileId,
              planCost,
              'Weekly plan cost',
              new Types.ObjectId(planId),
            );
          } catch (error) {
            console.error(`[PlansService] Error adding plan cost to balance for client ${clientProfileId}:`, error);
            // Don't throw - plan assignment should succeed even if balance update fails
          }
        }
      } catch (error) {
        console.error(`[PlansService] Error updating client profile ${clientProfileId}:`, error);
        throw error;
      }
    }
    

    // Add clients to plan's assignedClientIds
    await this.planModel.findByIdAndUpdate(planId, {
      $addToSet: { assignedClientIds: { $each: clientProfileIds } },
    }).exec();
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
        const client = await this.clientsService.getProfileById(clientProfileId);
        await this.workoutsService.generateWeeklyLogs(client, planForLogs as any, startDate);
      } catch (error) {
        console.error(`[PlansService] ❌ Error generating logs for client ${clientProfileId}:`, error);
        throw error;
      }
    }
    
    const response = {
      message: 'Plan assigned successfully',
      planId,
      clientIds: dto.clientIds,
      startDate,
      endDate: normalizedEndDate,
    };
    return response;
  }

  /**
   * Cancel plan assignment for clients
   * Marks future workout logs as missed and removes plan from clients
   */
  async cancelPlan(planId: string, clientId: string, userId: string, userRole: string): Promise<void> {
    AppLogger.logStart('PLAN_CANCEL', { planId, clientId, userId, userRole });

    try {
      const plan = await this.planModel.findById(planId).exec();
      if (!plan) {
        AppLogger.logError('PLAN_CANCEL', { planId, clientId }, new NotFoundException('Plan not found'));
        throw new NotFoundException('Plan not found');
      }

      AppLogger.logOperation('PLAN_CANCEL_PLAN_FOUND', {
        planId,
        clientId,
        planName: plan.name,
      }, 'debug');

      // Convert userId to clientProfileId (clientId might be userId from frontend)
      let clientProfileId: string;
      try {
        const client = await this.clientsService.getProfile(clientId);
        clientProfileId = (client as any)._id.toString();
        AppLogger.logOperation('PLAN_CANCEL_CLIENT_FOUND', {
          userId: clientId,
          clientProfileId,
        }, 'debug');
      } catch (e) {
        // If not found as userId, try as clientProfileId
        try {
          const client = await this.clientsService.getProfileById(clientId);
          clientProfileId = (client as any)._id.toString();
          AppLogger.logOperation('PLAN_CANCEL_CLIENT_FOUND_BY_ID', {
            clientId,
            clientProfileId,
          }, 'debug');
        } catch (e2) {
          AppLogger.logError('PLAN_CANCEL', { planId, clientId }, new NotFoundException('Client profile not found'));
          throw new NotFoundException('Client profile not found');
        }
      }

      // Delete uncompleted workout logs (instead of marking as missed)
      AppLogger.logOperation('PLAN_CANCEL_DELETE_WORKOUTS', {
        planId,
        clientProfileId,
      }, 'debug');

      const deletedCount = await this.workoutsService.deleteUncompletedWorkoutsForPlan(
        clientProfileId,
        planId,
      );

      AppLogger.logOperation('PLAN_CANCEL_WORKOUTS_DELETED', {
        planId,
        clientProfileId,
        deletedCount,
      }, 'info');

      // Remove penalties for this plan
      AppLogger.logOperation('PLAN_CANCEL_REMOVE_PENALTIES', {
        planId,
        clientProfileId,
      }, 'debug');

      const removedPenaltiesCount = await this.gamificationService.removePenaltiesForPlan(
        clientProfileId,
        planId,
      );

      AppLogger.logOperation('PLAN_CANCEL_PENALTIES_REMOVED', {
        planId,
        clientProfileId,
        removedPenaltiesCount,
      }, 'info');

      // Remove from client's planHistory and currentPlanId
      AppLogger.logOperation('PLAN_CANCEL_UPDATE_CLIENT', {
        planId,
        clientProfileId,
      }, 'debug');

      await this.clientModel.updateOne(
        { _id: new Types.ObjectId(clientProfileId) },
        {
          $pull: { planHistory: { planId: new Types.ObjectId(planId) } },
        }
      ).exec();

      AppLogger.logOperation('PLAN_CANCEL_CLIENT_UPDATED', {
        planId,
        clientId,
      }, 'debug');

      // Remove from plan's assignedClientIds
      AppLogger.logOperation('PLAN_CANCEL_UPDATE_PLAN', {
        planId,
        clientProfileId,
      }, 'debug');

      await this.planModel.updateOne(
        { _id: new Types.ObjectId(planId) },
        { $pull: { assignedClientIds: new Types.ObjectId(clientProfileId) } }
      ).exec();

      AppLogger.logOperation('PLAN_CANCEL_PLAN_UPDATED', {
        planId,
        clientProfileId,
      }, 'debug');

      AppLogger.logComplete('PLAN_CANCEL', {
        planId,
        clientId,
        clientProfileId,
        deletedWorkouts: deletedCount,
        removedPenalties: removedPenaltiesCount,
      });
    } catch (error) {
      AppLogger.logError('PLAN_CANCEL', { planId, clientId }, error);
      throw error;
    }
  }

  /**
   * Request next week - Client initiates request for next week's plan
   */
  async requestNextWeek(clientId: string): Promise<void> {
    AppLogger.logStart('NEXT_WEEK_REQUEST', {
      clientId,
    });

    try {
      // Validate that client can unlock next week
      AppLogger.logOperation('NEXT_WEEK_REQUEST_VALIDATE', {
        clientId,
      }, 'debug');

      const canUnlock = await this.canUnlockNextWeek(clientId);

      if (!canUnlock) {
        AppLogger.logWarning('NEXT_WEEK_REQUEST_INVALID', {
          clientId,
          reason: 'Current week not completed or no active plan',
        });
        throw new BadRequestException(
          'Cannot request next week. Current week must be completed first.'
        );
      }

      AppLogger.logOperation('NEXT_WEEK_REQUEST_VALID', {
        clientId,
      }, 'debug');

      // Set request flag
      await this.clientModel.findByIdAndUpdate(clientId, {
        $set: {
          nextWeekRequested: true,
          nextWeekRequestDate: new Date(),
        }
      }).exec();

      AppLogger.logOperation('NEXT_WEEK_REQUEST_SAVED', {
        clientId,
        requestDate: new Date().toISOString(),
      }, 'info');

      AppLogger.logComplete('NEXT_WEEK_REQUEST', {
        clientId,
      });
    } catch (error) {
      AppLogger.logError('NEXT_WEEK_REQUEST', { clientId }, error);
      throw error;
    }
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

