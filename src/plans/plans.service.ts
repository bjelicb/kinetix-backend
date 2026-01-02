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

  /**
   * Helper method to normalize plan ID to string
   * Handles: ObjectId, populated object with _id, string, null/undefined
   */
  private normalizePlanId(planId: any): string {
    if (!planId) {
      return '';
    }
    
    // If it's an object with _id property (populated object)
    if (typeof planId === 'object' && planId._id) {
      return planId._id.toString();
    }
    
    // If it's an ObjectId or has toString method
    if (typeof planId === 'object' && typeof planId.toString === 'function') {
      return planId.toString();
    }
    
    // If it's already a string
    if (typeof planId === 'string') {
      return planId;
    }
    
    // Fallback: convert to string
    return String(planId);
  }

  /**
   * Helper method to normalize trainer profile ID to string
   * Handles: ObjectId, populated object with _id, string, null/undefined
   */
  private normalizeTrainerProfileId(trainerId: any): string {
    if (!trainerId) {
      return '';
    }
    
    // If it's an object with _id property (populated object)
    if (typeof trainerId === 'object' && trainerId._id) {
      return trainerId._id.toString();
    }
    
    // If it's an ObjectId or has toString method
    if (typeof trainerId === 'object' && typeof trainerId.toString === 'function') {
      return trainerId.toString();
    }
    
    // If it's already a string
    if (typeof trainerId === 'string') {
      return trainerId;
    }
    
    // Fallback: convert to string
    return String(trainerId);
  }

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

  async getPlanById(planId: string, userId: string, userRole: string): Promise<any> {
    // For TRAINER: allow access to soft-deleted plans (they own)
    // For CLIENT and ADMIN: filter out soft-deleted plans
    const query: any = { _id: planId };
    if (userRole !== 'TRAINER') {
      query.isDeleted = { $ne: true };
    }
    
    const plan = await this.planModel
      .findOne(query)
      .populate('trainerId', 'businessName userId')
      .populate('assignedClientIds', 'userId')
      .lean()
      .exec();

    if (!plan) {
      console.log('[PlansService] ✗ Plan not found');
      throw new NotFoundException('Plan not found');
    }

    // Verify ownership (ADMIN can access all plans)
    if (userRole !== 'ADMIN') {
      const planObj = plan as any;
      
      if (userRole === 'CLIENT') {
        // For CLIENT: verify that plan is assigned to this client
        let clientProfile: any;
        let clientProfileId: string;
        
        try {
          clientProfile = await this.clientsService.getProfile(userId);
          clientProfileId = (clientProfile as any)._id.toString();
        } catch (e) {
          try {
            clientProfile = await this.clientsService.getProfileById(userId);
            clientProfileId = (clientProfile as any)._id.toString();
          } catch (e2) {
            throw new NotFoundException('Client profile not found');
          }
        }
        
        if (!clientProfile) {
          throw new NotFoundException('Client profile not found');
        }
        
        const planIdStr = planObj._id.toString();
        const clientProfileIdObj = new Types.ObjectId(clientProfileId);
        
        // Check if plan is in assignedClientIds (primary check)
        const planWithClients = await this.planModel
          .findById(planIdStr)
          .select('assignedClientIds')
          .lean()
          .exec();
        
        const assignedClientIds = planWithClients?.assignedClientIds || [];
        
        const isAssignedToClient = assignedClientIds.some((clientId: any) => {
          if (!clientId) {
            return false;
          }
          
          try {
            // assignedClientIds stores clientProfileId as ObjectId (from $addToSet)
            const clientIdObj = clientId instanceof Types.ObjectId 
              ? clientId 
              : new Types.ObjectId(clientId);
            const equals = clientIdObj.equals(clientProfileIdObj);
            return equals;
          } catch (e) {
            // Fallback to string comparison
            const clientIdStr = this.normalizePlanId(clientId);
            const stringEquals = clientIdStr === clientProfileId;
            return stringEquals;
          }
        });
        
        // Also check planHistory as fallback
        let planInHistory = false;
        if (!isAssignedToClient) {
          // Use direct DB query to ensure we get fresh data
          const clientWithHistory = await this.clientModel
            .findById(clientProfileId)
            .select('planHistory')
            .lean()
            .exec();
          
          if (clientWithHistory?.planHistory && clientWithHistory.planHistory.length > 0) {
            const planIdObj = new Types.ObjectId(planIdStr);
            planInHistory = (clientWithHistory.planHistory || []).some((entry: any) => {
              if (!entry || !entry.planId) {
                return false;
              }
              
              try {
                const entryPlanIdObj = entry.planId instanceof Types.ObjectId 
                  ? entry.planId 
                  : new Types.ObjectId(entry.planId);
                const equals = entryPlanIdObj.equals(planIdObj);
                return equals;
              } catch (e) {
                const entryPlanIdStr = this.normalizePlanId(entry.planId);
                const stringEquals = entryPlanIdStr === planIdStr;
                return stringEquals;
              }
            });
          }
        }
        
        if (!planInHistory && !isAssignedToClient) {
          throw new ForbiddenException('You can only access plans assigned to you');
        }
      } else if (userRole === 'TRAINER') {
        // For TRAINER: verify that plan belongs to this trainer
        const planTrainerProfileId = (planObj.trainerId as any)?._id?.toString() || (planObj.trainerId as any)?.toString() || null;
        
        if (!planTrainerProfileId) {
          throw new NotFoundException('Plan trainer not found');
        }

        // Get trainer profile to verify ownership
        const trainerProfile = await this.trainersService.getProfile(userId);
        if (!trainerProfile) {
          throw new NotFoundException('Trainer profile not found');
        }
        const trainerProfileId = (trainerProfile as any)._id.toString();

        // Verify that plan belongs to this trainer
        if (planTrainerProfileId !== trainerProfileId) {
          console.log('[PlansService] Forbidden: Plan trainerId does not match current user');
          throw new ForbiddenException('You can only access your own plans');
        }
      }
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
    AppLogger.logStart('CAN_UNLOCK_CHECK', { clientId });

    const client = await this.clientsService.getProfileById(clientId);
    
    // If no currentPlanId, client can unlock (they will unlock the first plan from planHistory)
    // Plan can be unlocked before it starts - the first workout can only be done when plan starts
    if (!client.currentPlanId) {
      AppLogger.logComplete('CAN_UNLOCK_CHECK', {
        clientId,
        result: true,
        reason: 'No currentPlanId - can unlock first plan',
      });
      return true;
    }
    
    // Extract ID from currentPlanId (might be populated plan object or just ObjectId)
    const currentPlanIdStr = (client.currentPlanId as any)?._id?.toString() || client.currentPlanId?.toString() || '';
    
    AppLogger.logOperation('CAN_UNLOCK_CHECK_HAS_CURRENT_PLAN', {
      clientId,
      currentPlanId: currentPlanIdStr,
      currentPlanIdRaw: client.currentPlanId,
      currentPlanIdType: typeof client.currentPlanId,
    }, 'debug');
    
    // Get current unlocked plan entry from currentPlanId
    const currentPlanEntry = this.clientsService.getActivePlanEntry(client);
    
    if (!currentPlanEntry) {
      // currentPlanId exists but not found in planHistory (data inconsistency)
      // Allow unlock to recover
      AppLogger.logOperation('CAN_UNLOCK_CHECK_PLAN_ENTRY_NOT_FOUND', {
        clientId,
        currentPlanId: currentPlanIdStr,
        canUnlock: true,
        reason: 'currentPlanId exists but not in planHistory - data inconsistency, allow unlock to recover',
      }, 'warn');
      
      AppLogger.logComplete('CAN_UNLOCK_CHECK', {
        clientId,
        result: true,
        reason: 'Plan entry not found in history',
      });
      
      return true;
    }
    
    // Get ALL workout logs for current plan
    const allWorkoutLogs = await this.workoutsService.getWorkoutLogsByClient(clientId);
    
    // Log first few workout logs to see their structure
    AppLogger.logOperation('CAN_UNLOCK_CHECK_WORKOUT_LOGS_RAW', {
      clientId,
      currentPlanId: currentPlanIdStr,
      totalWorkoutLogs: allWorkoutLogs.length,
      sampleLogs: allWorkoutLogs.slice(0, 3).map(log => ({
        workoutDate: log.workoutDate,
        dayOfWeek: log.dayOfWeek,
        weeklyPlanId: log.weeklyPlanId,
        weeklyPlanIdType: typeof log.weeklyPlanId,
        weeklyPlanIdIsObject: typeof log.weeklyPlanId === 'object',
        weeklyPlanId_id: (log.weeklyPlanId as any)?._id,
        weeklyPlanId_idType: typeof (log.weeklyPlanId as any)?._id,
        weeklyPlanId_idToString: (log.weeklyPlanId as any)?._id?.toString(),
      })),
    }, 'info');
    
    const currentPlanLogs = allWorkoutLogs.filter(log => {
      // Handle both populated (object with _id) and non-populated (ObjectId) cases
      let logPlanId: string;
      const weeklyPlanId = log.weeklyPlanId as any;
      
      if (weeklyPlanId && typeof weeklyPlanId === 'object') {
        // Populated case: { _id: ObjectId, name: string }
        if (weeklyPlanId._id) {
          logPlanId = weeklyPlanId._id.toString();
        } else {
          // Fallback: try to convert the object itself
          logPlanId = String(weeklyPlanId);
        }
      } else if (weeklyPlanId) {
        // Non-populated case: ObjectId or string
        logPlanId = String(weeklyPlanId);
      } else {
        logPlanId = '';
      }
      
      const matches = logPlanId === currentPlanIdStr;
      
      // Log first few comparisons for debugging
      if (allWorkoutLogs.indexOf(log) < 3) {
        AppLogger.logOperation('CAN_UNLOCK_CHECK_WORKOUT_LOG_COMPARISON', {
          clientId,
          workoutDate: log.workoutDate,
          dayOfWeek: log.dayOfWeek,
          logPlanId,
          currentPlanIdStr,
          matches,
          weeklyPlanIdRaw: weeklyPlanId,
          weeklyPlanIdType: typeof weeklyPlanId,
        }, 'debug');
      }
      
      return matches;
    });
    
    AppLogger.logOperation('CAN_UNLOCK_CHECK_WORKOUT_LOGS', {
      clientId,
      currentPlanId: currentPlanIdStr,
      totalWorkoutLogs: allWorkoutLogs.length,
      currentPlanLogs: currentPlanLogs.length,
    }, 'info');
    
    if (currentPlanLogs.length === 0) {
      // No workout logs for current plan - cannot unlock until at least one workout is logged
      AppLogger.logOperation('CAN_UNLOCK_CHECK_NO_WORKOUT_LOGS', {
        clientId,
        currentPlanId: currentPlanIdStr,
        canUnlock: false,
        reason: 'No workout logs for current plan - must complete at least one workout before unlocking next week',
      }, 'info');
      
      AppLogger.logComplete('CAN_UNLOCK_CHECK', {
        clientId,
        result: false,
        reason: 'No workout logs - plan not started',
      });
      
      return false;
    }
    
    // Get plan to check rest days
    const plan = await this.planModel.findById(currentPlanIdStr).exec();
    if (!plan) {
      // Plan deleted, allow unlock
      AppLogger.logOperation('CAN_UNLOCK_CHECK_PLAN_DELETED', {
        clientId,
        currentPlanId: currentPlanIdStr,
        canUnlock: true,
        reason: 'Plan deleted - allow unlock',
      }, 'warn');
      
      AppLogger.logComplete('CAN_UNLOCK_CHECK', {
        clientId,
        result: true,
        reason: 'Plan deleted',
      });
      
      return true;
    }

    AppLogger.logOperation('CAN_UNLOCK_CHECK_PLAN_LOADED', {
      clientId,
      currentPlanId: currentPlanIdStr,
      planName: (plan as any).name,
      workoutsCount: (plan.workouts || []).length,
      workouts: (plan.workouts || []).map((w: any) => ({
        dayOfWeek: w.dayOfWeek,
        name: w.name,
        isRestDay: w.isRestDay,
      })),
    }, 'info');
    
    // Find the last workout log date from current plan
    const lastWorkoutDate = currentPlanLogs.reduce((latest, log) => {
      const logDate = new Date(log.workoutDate);
      return logDate > latest ? logDate : latest;
    }, new Date(0));

    AppLogger.logOperation('CAN_UNLOCK_CHECK_WORKOUT_LOGS_DETAILS', {
      clientId,
      currentPlanId: currentPlanIdStr,
      workoutLogs: currentPlanLogs.map(log => ({
        workoutDate: log.workoutDate,
        dayOfWeek: log.dayOfWeek,
        workoutName: (log as any).workoutName || 'Unknown',
        isCompleted: log.isCompleted,
        isMissed: log.isMissed,
      })),
    }, 'info');
    
    const today = DateUtils.normalizeToStartOfDay(new Date());
    const lastWorkoutDateNormalized = DateUtils.normalizeToStartOfDay(lastWorkoutDate);
    
    AppLogger.logOperation('CAN_UNLOCK_CHECK_DATE_COMPARISON', {
      clientId,
      currentPlanId: currentPlanIdStr,
      today: today.toISOString(),
      lastWorkoutDate: lastWorkoutDateNormalized.toISOString(),
      lastWorkoutDatePassed: today > lastWorkoutDateNormalized,
      daysDifference: Math.floor((today.getTime() - lastWorkoutDateNormalized.getTime()) / (1000 * 60 * 60 * 24)),
    }, 'info');
    
    // Check if last workout day has passed
    if (today <= lastWorkoutDateNormalized) {
      // Last workout day hasn't passed yet, cannot unlock
      AppLogger.logOperation('CAN_UNLOCK_CHECK_RESULT', {
        clientId,
        currentPlanId: currentPlanIdStr,
        canUnlock: false,
        reason: 'Last workout day has not passed yet',
        lastWorkoutDate: lastWorkoutDateNormalized.toISOString(),
        today: today.toISOString(),
      }, 'info');
      
      AppLogger.logComplete('CAN_UNLOCK_CHECK', {
        clientId,
        result: false,
        reason: 'Current week still active',
      });
      
      return false;
    }
    
    // Last workout day has passed, check if all non-rest-day workouts are completed
    const incompleteWorkouts = currentPlanLogs.filter(log => {
      // Find the workout day in plan - normalize both to numbers for comparison
      const logDayOfWeek = typeof log.dayOfWeek === 'number' ? log.dayOfWeek : Number(log.dayOfWeek);
      const workoutDay = (plan.workouts || []).find((w: any) => {
        const wDayOfWeek = typeof w.dayOfWeek === 'number' ? w.dayOfWeek : Number(w.dayOfWeek);
        return wDayOfWeek === logDayOfWeek;
      });
      
      // Rest days don't need to be completed
      if (workoutDay && workoutDay.isRestDay) {
        AppLogger.logOperation('CAN_UNLOCK_CHECK_WORKOUT_DETAIL', {
          clientId,
          workoutDate: log.workoutDate,
          dayOfWeek: log.dayOfWeek,
          workoutName: (log as any).workoutName || 'Unknown',
          isCompleted: log.isCompleted,
          isRestDay: true,
          isIncomplete: false,
          workoutDayFound: true,
          reason: 'Rest day - skipped',
        }, 'debug');
        return false; // Not incomplete (rest day)
      }
      
      // Check if workout is completed (must be exactly true)
      const isCompleted = log.isCompleted === true;
      const isIncomplete = !isCompleted;
      
      // Log each workout for debugging
      AppLogger.logOperation('CAN_UNLOCK_CHECK_WORKOUT_DETAIL', {
        clientId,
        workoutDate: log.workoutDate,
        dayOfWeek: log.dayOfWeek,
        workoutName: (log as any).workoutName || 'Unknown',
        isCompleted: log.isCompleted,
        isCompletedType: typeof log.isCompleted,
        isCompletedStrict: isCompleted,
        isRestDay: workoutDay?.isRestDay || false,
        isIncomplete,
        workoutDayFound: !!workoutDay,
        workoutDayDayOfWeek: workoutDay?.dayOfWeek,
      }, 'info');
      
      return isIncomplete;
    });
    
    const allCompleted = incompleteWorkouts.length === 0;
    
    AppLogger.logOperation('CAN_UNLOCK_CHECK_COMPLETION_STATUS', {
      clientId,
      currentPlanId: currentPlanIdStr,
      totalWorkouts: currentPlanLogs.length,
      incompleteWorkouts: incompleteWorkouts.length,
      allCompleted,
      incompleteWorkoutDates: incompleteWorkouts.map(log => ({
        date: log.workoutDate,
        dayOfWeek: log.dayOfWeek,
        isCompleted: log.isCompleted,
      })),
    }, 'info');
    
    AppLogger.logOperation('CAN_UNLOCK_CHECK_RESULT', {
      clientId,
      currentPlanId: currentPlanIdStr,
      canUnlock: allCompleted,
      reason: allCompleted 
        ? 'All workouts completed and last workout day has passed' 
        : `Incomplete workouts: ${incompleteWorkouts.length}`,
      incompleteWorkoutsCount: incompleteWorkouts.length,
    }, 'info');
    
    AppLogger.logComplete('CAN_UNLOCK_CHECK', {
      clientId,
      result: allCompleted,
      reason: allCompleted ? 'All workouts completed' : `${incompleteWorkouts.length} incomplete workouts`,
    });
    
    return allCompleted;
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
    AppLogger.logStart('PLAN_ASSIGN', {
      planId,
      userId,
      userRole,
      clientIds: dto.clientIds,
      startDate: dto.startDate,
    });

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
        
        // Only check unlock if client has a currentPlanId (active plan)
        // If client has no currentPlanId, they can be assigned a new plan (it will be unlocked via requestNextWeek)
        if (client.currentPlanId) {
          const canUnlock = await this.canUnlockNextWeek(clientProfileId);
          if (!canUnlock) {
            throw new BadRequestException(
              `Client cannot be assigned a new plan. Current week must be completed first. Complete all workouts in the current week before assigning a new plan.`
            );
          }
        }
        // If no currentPlanId, allow assign (plan will be unlocked via requestNextWeek)
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
      AppLogger.logError('PLAN_ASSIGN', { planId }, new NotFoundException('Plan not found'));
      throw new NotFoundException('Plan not found');
    }

    AppLogger.logOperation('PLAN_ASSIGN_PLAN_FOUND', {
      planId,
      planName: (plan as any).name,
      weeklyCost: (plan as any).weeklyCost || 0,
    }, 'info');

    const planTrainerId = (plan.trainerId as any)?._id || plan.trainerId;
    
    // If user is ADMIN, skip ownership check
    if (userRole !== 'ADMIN') {
      // Get trainer profile to get trainerProfileId
      const trainerProfile = await this.trainersService.getProfile(userId);
      const trainerProfileId = (trainerProfile as any)._id;
      
      AppLogger.logOperation('PLAN_ASSIGN_OWNERSHIP_CHECK', {
        planId,
        planTrainerId: planTrainerId.toString(),
        userTrainerProfileId: trainerProfileId.toString(),
      }, 'debug');
      
      if (planTrainerId.toString() !== trainerProfileId.toString()) {
        AppLogger.logError('PLAN_ASSIGN', { planId, userId }, new ForbiddenException('You can only assign your own plans'));
        throw new ForbiddenException('You can only assign your own plans');
      }
    } else {
      AppLogger.logOperation('PLAN_ASSIGN_ADMIN_SKIP_OWNERSHIP', {
        planId,
        userId,
      }, 'debug');
    }

    // Parse startDate as UTC (append T00:00:00.000Z if date-only string to prevent timezone conversion)
    const dateString = dto.startDate.includes('T') ? dto.startDate : `${dto.startDate}T00:00:00.000Z`;
    const startDate = DateUtils.normalizeToStartOfDay(new Date(dateString));
    const endDate = DateUtils.addDays(startDate, 7); // 7 days cycle
    const normalizedEndDate = DateUtils.normalizeToEndOfDay(endDate);

    AppLogger.logOperation('PLAN_ASSIGN_DATES_CALCULATED', {
      planId,
      startDate: startDate.toISOString(),
      endDate: normalizedEndDate.toISOString(),
    }, 'debug');

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
        AppLogger.logError('PLAN_ASSIGN_CLIENT_RESOLVE', { planId, clientId }, error as Error);
        throw error;
      }
    }

    AppLogger.logOperation('PLAN_ASSIGN_CLIENTS_RESOLVED', {
      planId,
      totalClients: clientProfileIds.length,
      clientProfileIds: clientProfileIds.map(id => id.toString()),
    }, 'info');
    
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

    AppLogger.logOperation('PLAN_ASSIGN_CLIENTS_SEPARATED', {
      planId,
      existingClients: existingClients.length,
      newClients: newClients.length,
    }, 'info');
    
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
        
        // Get client before update to check currentPlanId
        const clientBeforeUpdate = await this.clientsService.getProfileById(clientProfileId);
        const currentPlanIdBefore = this.normalizePlanId(clientBeforeUpdate.currentPlanId);
        
        AppLogger.logOperation('PLAN_ASSIGN_BEFORE_UPDATE', {
          planId,
          clientProfileId: clientProfileId.toString(),
          currentPlanIdBefore,
          willSetCurrentPlanId: false, // We NEVER set currentPlanId during assign
        }, 'info');

        await this.clientModel.findByIdAndUpdate(clientProfileId, {
          $push: { planHistory: historyEntry },
          $set: {
            trainerId: finalTrainerId,
            // NOTE: currentPlanId is NOT set here! Plan must be unlocked via requestNextWeek()
          },
        }).exec();

        // Verify currentPlanId was NOT changed
        const clientAfterUpdate = await this.clientsService.getProfileById(clientProfileId);
        const currentPlanIdAfter = this.normalizePlanId(clientAfterUpdate.currentPlanId);
        
        AppLogger.logOperation('PLAN_ASSIGN_PLANHISTORY_UPDATED', {
          planId,
          clientProfileId: clientProfileId.toString(),
          planStartDate: startDate.toISOString(),
          planEndDate: normalizedEndDate.toISOString(),
          currentPlanIdBefore,
          currentPlanIdAfter,
          currentPlanIdUnchanged: currentPlanIdBefore === currentPlanIdAfter,
        }, 'info');
        
        // NOTE: Balance is NOT charged here!
        // Balance is charged when client UNLOCKS the plan via requestNextWeek()
        // This allows admin to assign multiple future plans without charging client
        AppLogger.logOperation('PLAN_ASSIGN_BALANCE_NOT_CHARGED', {
          planId,
          clientProfileId: clientProfileId.toString(),
          weeklyCost: (plan as any).weeklyCost || 0,
          reason: 'Balance charged on unlock via requestNextWeek()',
        }, 'info');
      } catch (error) {
        AppLogger.logError('PLAN_ASSIGN_CLIENT_UPDATE', { planId, clientProfileId: clientProfileId.toString() }, error as Error);
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
    AppLogger.logOperation('PLAN_ASSIGN_GENERATING_WORKOUT_LOGS', {
      planId,
      newClientsCount: newClients.length,
      newClientIds: newClients.map(id => id.toString()),
    }, 'info');

    for (const clientProfileId of newClients) {
      try {
        const client = await this.clientsService.getProfileById(clientProfileId);
        await this.workoutsService.generateWeeklyLogs(client, planForLogs as any, startDate);
        
        AppLogger.logOperation('PLAN_ASSIGN_WORKOUT_LOGS_GENERATED', {
          planId,
          clientProfileId: clientProfileId.toString(),
          startDate: startDate.toISOString(),
        }, 'info');
      } catch (error) {
        AppLogger.logError('PLAN_ASSIGN_WORKOUT_LOGS_GENERATION', { planId, clientProfileId: clientProfileId.toString() }, error as Error);
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

    AppLogger.logComplete('PLAN_ASSIGN', {
      planId,
      assignedClients: clientProfileIds.length,
      newClients: newClients.length,
      existingClients: existingClients.length,
      startDate: startDate.toISOString(),
      endDate: normalizedEndDate.toISOString(),
    });

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
      let clientProfile: ClientProfileDocument;
      try {
        const client = await this.clientsService.getProfile(clientId);
        clientProfile = client as any;
        clientProfileId = clientProfile._id.toString();
        AppLogger.logOperation('PLAN_CANCEL_CLIENT_FOUND', {
          userId: clientId,
          clientProfileId,
        }, 'debug');
      } catch (e) {
        // If not found as userId, try as clientProfileId
        try {
          const client = await this.clientsService.getProfileById(clientId);
          clientProfile = client as any;
          clientProfileId = clientProfile._id.toString();
          AppLogger.logOperation('PLAN_CANCEL_CLIENT_FOUND_BY_ID', {
            clientId,
            clientProfileId,
          }, 'debug');
        } catch (e2) {
          AppLogger.logError('PLAN_CANCEL', { planId, clientId }, new NotFoundException('Client profile not found'));
          throw new NotFoundException('Client profile not found');
        }
      }

      // Validate ownership: TRAINER can only cancel plans for their own clients
      if (userRole === 'TRAINER') {
        // Get trainer profile to get trainerProfileId from userId
        const trainerProfile = await this.trainersService.getProfile(userId);
        if (!trainerProfile) {
          AppLogger.logError('PLAN_CANCEL', { planId, clientId, userId }, new NotFoundException('Trainer profile not found'));
          throw new NotFoundException('Trainer profile not found');
        }
        const userTrainerProfileId = (trainerProfile as any)._id.toString();
        
        // Get client's trainer profile ID - normalize to handle populated objects
        const clientTrainerProfileId = this.normalizeTrainerProfileId(clientProfile.trainerId);
        
        if (!clientTrainerProfileId || clientTrainerProfileId !== userTrainerProfileId) {
          AppLogger.logError('PLAN_CANCEL', { 
            planId, 
            clientId, 
            userId, 
            userTrainerProfileId,
            clientTrainerProfileId 
          }, new ForbiddenException('You can only cancel plans for your own clients'));
          throw new ForbiddenException('You can only cancel plans for your own clients');
        }
      }
      // ADMIN can cancel plans for any client (no ownership check needed)

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

      // Get client to check if this plan is currently active
      const client = await this.clientsService.getProfileById(clientProfileId);
      const currentPlanIdStr = this.normalizePlanId(client.currentPlanId);
      const planIdStr = new Types.ObjectId(planId).toString();
      
      // Check if currentPlanId matches the plan being cancelled
      // Use both string comparison and ObjectId comparison for robustness
      let isCurrentPlan = false;
      if (currentPlanIdStr) {
        try {
          // Try string comparison first
          isCurrentPlan = currentPlanIdStr === planIdStr;
          
          // If string comparison fails, try ObjectId comparison
          if (!isCurrentPlan && client.currentPlanId) {
            try {
              const currentPlanIdObj = new Types.ObjectId(client.currentPlanId);
              const planIdObj = new Types.ObjectId(planId);
              isCurrentPlan = currentPlanIdObj.equals(planIdObj);
            } catch (e) {
              // If ObjectId conversion fails, fall back to string comparison
              isCurrentPlan = currentPlanIdStr === planIdStr;
            }
          }
        } catch (e) {
          // Fall back to simple string comparison
          isCurrentPlan = currentPlanIdStr === planIdStr;
        }
      }
      
      AppLogger.logOperation('PLAN_CANCEL_CHECK_CURRENT_PLAN', {
        planId,
        clientProfileId,
        currentPlanId: currentPlanIdStr,
        currentPlanIdRaw: client.currentPlanId,
        planIdStr,
        isCurrentPlan,
        currentPlanIdType: typeof client.currentPlanId,
        planIdType: typeof planId,
      }, 'info');

      // Build update object
      const updateObj: any = {
        $pull: { planHistory: { planId: new Types.ObjectId(planId) } },
      };

      // IMPORTANT: Always clear currentPlanId if it matches the plan being cancelled
      // This ensures that when a plan is unassigned, currentPlanId is properly cleared
      if (isCurrentPlan) {
        updateObj.$set = { currentPlanId: null };
        AppLogger.logOperation('PLAN_CANCEL_CLEARING_CURRENT_PLAN', {
          planId,
          clientProfileId,
          currentPlanIdBefore: currentPlanIdStr,
          reason: 'Plan matches currentPlanId - clearing currentPlanId',
        }, 'info');
      } else {
        // Also check if plan is in planHistory and will be removed
        // If currentPlanId points to a plan that's being removed, clear it
        const planInHistory = client.planHistory?.some(entry => {
          const entryPlanId = this.normalizePlanId(entry.planId);
          return entryPlanId === planIdStr;
        });
        
        if (planInHistory && currentPlanIdStr === planIdStr) {
          // Plan is in history and matches currentPlanId - clear it
          updateObj.$set = { currentPlanId: null };
          AppLogger.logOperation('PLAN_CANCEL_CLEARING_CURRENT_PLAN', {
            planId,
            clientProfileId,
            currentPlanIdBefore: currentPlanIdStr,
            reason: 'Plan is in history and matches currentPlanId - clearing currentPlanId',
          }, 'info');
        } else {
          AppLogger.logOperation('PLAN_CANCEL_NOT_CURRENT_PLAN', {
            planId,
            clientProfileId,
            currentPlanId: currentPlanIdStr,
            planInHistory,
            reason: 'Plan does not match currentPlanId - currentPlanId will not be cleared',
          }, 'debug');
        }
      }

      await this.clientModel.updateOne(
        { _id: new Types.ObjectId(clientProfileId) },
        updateObj
      ).exec();

      // Verify that currentPlanId was cleared if it matched
      const verifyClient = await this.clientsService.getProfileById(clientProfileId);
      const verifyCurrentPlanId = this.normalizePlanId(verifyClient.currentPlanId);
      const verifyPlanInHistory = verifyClient.planHistory?.some(entry => {
        const entryPlanId = this.normalizePlanId(entry.planId);
        return entryPlanId === planIdStr;
      });
      
      AppLogger.logOperation('PLAN_CANCEL_VERIFY', {
        planId,
        clientProfileId,
        currentPlanIdAfter: verifyCurrentPlanId,
        planInHistoryAfter: verifyPlanInHistory,
        wasCurrentPlanCleared: isCurrentPlan && (!verifyCurrentPlanId || verifyCurrentPlanId === ''),
        planWasRemovedFromHistory: !verifyPlanInHistory,
      }, 'info');
      
      // If currentPlanId still points to the cancelled plan, force clear it
      if (verifyCurrentPlanId === planIdStr) {
        AppLogger.logWarning('PLAN_CANCEL_CURRENT_PLAN_STILL_SET', {
          planId,
          clientProfileId,
          currentPlanIdAfter: verifyCurrentPlanId,
          reason: 'currentPlanId still points to cancelled plan - forcing clear',
        });
        
        await this.clientModel.updateOne(
          { _id: new Types.ObjectId(clientProfileId) },
          { $set: { currentPlanId: null } }
        ).exec();
        
        AppLogger.logOperation('PLAN_CANCEL_FORCE_CLEARED_CURRENT_PLAN', {
          planId,
          clientProfileId,
        }, 'warn');
      }

      AppLogger.logOperation('PLAN_CANCEL_CLIENT_UPDATED', {
        planId,
        clientId,
        currentPlanIdCleared: isCurrentPlan,
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
  async requestNextWeek(clientId: string): Promise<{ currentPlanId: string; balance: number; monthlyBalance: number }> {
    AppLogger.logStart('NEXT_WEEK_REQUEST', {
      clientId,
    });

    try {
      // 1. Get client profile
      const client = await this.clientsService.getProfileById(clientId);
      
      // 2. Validate that client can unlock next week
      // Extract currentPlanId string (handle populated object)
      const currentPlanIdForLog = (client.currentPlanId as any)?._id?.toString() || client.currentPlanId?.toString() || null;
      AppLogger.logOperation('NEXT_WEEK_REQUEST_VALIDATE', {
        clientId,
        currentPlanId: currentPlanIdForLog,
        currentPlanIdRaw: client.currentPlanId,
        currentPlanIdType: typeof client.currentPlanId,
        planHistoryLength: client.planHistory?.length || 0,
      }, 'info');

      const canUnlock = await this.canUnlockNextWeek(clientId);

      if (!canUnlock) {
        AppLogger.logWarning('NEXT_WEEK_REQUEST_INVALID', {
          clientId,
          reason: 'Current week not completed',
        });
        throw new BadRequestException(
          'Cannot request next week. Current week must be completed first.'
        );
      }

      AppLogger.logOperation('NEXT_WEEK_REQUEST_VALID', {
        clientId,
      }, 'debug');

      // 3. Find next plan in planHistory (sorted by startDate)
      if (!client.planHistory || client.planHistory.length === 0) {
        throw new BadRequestException('No plans assigned. Please contact your trainer.');
      }

      const sortedPlans = [...client.planHistory].sort((a, b) => 
        new Date(a.planStartDate).getTime() - new Date(b.planStartDate).getTime()
      );

      let nextPlan;
      if (!client.currentPlanId) {
        // First unlock - take first plan that is not completed yet (planEndDate >= today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const futurePlan = sortedPlans.find(entry => {
          const planEndDate = new Date(entry.planEndDate);
          planEndDate.setHours(23, 59, 59, 999);
          return planEndDate >= today;
        });
        
        if (!futurePlan) {
          throw new BadRequestException('No future plan available. Your trainer has not assigned a future plan yet.');
        }
        
        nextPlan = futurePlan;
        
        AppLogger.logOperation('NEXT_WEEK_REQUEST_FIRST_UNLOCK', {
          clientId,
          nextPlanId: nextPlan.planId.toString(),
          planStartDate: nextPlan.planStartDate,
          planEndDate: nextPlan.planEndDate,
          reason: 'First plan that is not completed yet',
        }, 'info');
      } else {
        // Find current plan and get next one
        // Normalize currentPlanId to string (handle populated object, ObjectId, string)
        const currentPlanIdStr = this.normalizePlanId(client.currentPlanId);
        
        AppLogger.logOperation('NEXT_WEEK_REQUEST_FINDING_CURRENT_PLAN', {
          clientId,
          currentPlanIdRaw: client.currentPlanId,
          currentPlanIdStr,
          currentPlanIdType: typeof client.currentPlanId,
          planHistoryLength: sortedPlans.length,
          planHistoryEntries: sortedPlans.map((p, idx) => {
            const normalizedPlanId = this.normalizePlanId(p.planId);
            return {
              index: idx,
              planIdRaw: p.planId,
              planIdNormalized: normalizedPlanId,
              planIdType: typeof p.planId,
              planIdIsObject: typeof p.planId === 'object',
              planId_id: (p.planId as any)?._id?.toString(),
              planStartDate: p.planStartDate,
              matches: normalizedPlanId === currentPlanIdStr,
            };
          }),
        }, 'info');
        
        const currentIndex = sortedPlans.findIndex((p) => {
          // Normalize planId from planHistory entry
          const planIdStr = this.normalizePlanId(p.planId);
          const matches = planIdStr === currentPlanIdStr;
          
          AppLogger.logOperation('NEXT_WEEK_REQUEST_PLAN_COMPARISON', {
            clientId,
            planIdStr,
            currentPlanIdStr,
            matches,
            planStartDate: p.planStartDate,
          }, 'debug');
          
          return matches;
        });

        if (currentIndex === -1) {
          // Data inconsistency: currentPlanId exists but not in planHistory
          // Try to recover by adding it to planHistory
          AppLogger.logWarning('NEXT_WEEK_REQUEST_CURRENT_PLAN_NOT_FOUND', {
            clientId,
            currentPlanIdStr,
            planHistoryEntries: sortedPlans.map(p => ({
              planId: this.normalizePlanId(p.planId),
              planIdType: typeof p.planId,
              planId_id: (p.planId as any)?._id?.toString(),
            })),
            attemptingRecovery: true,
          });
          
          // Try to get plan details to add to history
          try {
            const currentPlan = await this.planModel.findById(currentPlanIdStr).exec();
            if (currentPlan) {
              // Find the most recent plan entry to get dates
              const mostRecentEntry = sortedPlans[sortedPlans.length - 1];
              const recoveryEntry = {
                planId: new Types.ObjectId(currentPlanIdStr),
                planStartDate: mostRecentEntry?.planEndDate ? new Date(new Date(mostRecentEntry.planEndDate).getTime() + 1) : new Date(),
                planEndDate: new Date(new Date(mostRecentEntry?.planEndDate || new Date()).getTime() + 7 * 24 * 60 * 60 * 1000),
                assignedAt: new Date(),
                trainerId: client.trainerId || mostRecentEntry?.trainerId,
              };
              
              await this.clientModel.findByIdAndUpdate(clientId, {
                $push: { planHistory: recoveryEntry },
              }).exec();
              
              AppLogger.logOperation('NEXT_WEEK_REQUEST_DATA_RECOVERY', {
                clientId,
                currentPlanIdStr,
                recoveryEntry,
              }, 'warn');
              
              // Re-fetch client to get updated planHistory
              const updatedClient = await this.clientsService.getProfileById(clientId);
              const updatedSortedPlans = [...updatedClient.planHistory].sort((a, b) => 
                new Date(a.planStartDate).getTime() - new Date(b.planStartDate).getTime()
              );
              
              // Try to find current plan again
              const recoveredIndex = updatedSortedPlans.findIndex((p) => {
                const planIdStr = this.normalizePlanId(p.planId);
                return planIdStr === currentPlanIdStr;
              });
              
              if (recoveredIndex === -1) {
                AppLogger.logError('NEXT_WEEK_REQUEST_RECOVERY_FAILED', {
                  clientId,
                  currentPlanIdStr,
                }, new Error('Data recovery failed - still cannot find current plan'));
                throw new BadRequestException('Current plan not found in history. Data recovery failed.');
              }
              
              // Use recovered index
              nextPlan = updatedSortedPlans[recoveredIndex + 1];
              
              if (!nextPlan) {
                throw new BadRequestException('No next plan available. Your trainer has not assigned the next week yet.');
              }
              
              AppLogger.logOperation('NEXT_WEEK_REQUEST_RECOVERY_SUCCESS', {
                clientId,
                currentPlanIdStr,
                nextPlanId: this.normalizePlanId(nextPlan.planId),
              }, 'info');
            } else {
              throw new BadRequestException('Current plan not found in database. Data inconsistency.');
            }
          } catch (recoveryError) {
            AppLogger.logError('NEXT_WEEK_REQUEST_RECOVERY_ERROR', {
              clientId,
              currentPlanIdStr,
            }, recoveryError as Error);
            throw new BadRequestException('Current plan not found in history. Data inconsistency.');
          }
        } else {
          // Current plan found in history - get next plan
          nextPlan = sortedPlans[currentIndex + 1];
          
          if (!nextPlan) {
            throw new BadRequestException('No next plan available. Your trainer has not assigned the next week yet.');
          }

          AppLogger.logOperation('NEXT_WEEK_REQUEST_NEXT_PLAN_FOUND', {
            clientId,
            currentPlanId: currentPlanIdStr,
            nextPlanId: this.normalizePlanId(nextPlan.planId),
          }, 'info');
        }
      }

      // 4. Get plan details for weeklyCost
      // Normalize nextPlan.planId to string for findById
      const nextPlanIdStr = this.normalizePlanId(nextPlan.planId);
      const plan = await this.planModel.findById(nextPlanIdStr).exec();
      if (!plan) {
        throw new NotFoundException('Plan not found. It may have been deleted.');
      }

      const weeklyCost = (plan as any).weeklyCost || 0;

      AppLogger.logOperation('NEXT_WEEK_REQUEST_PLAN_DETAILS', {
        clientId,
        planId: nextPlan.planId.toString(),
        planName: plan.name,
        weeklyCost,
      }, 'info');

      // Get current balance before charging
      const oldBalance = client.balance || 0;
      const oldMonthlyBalance = client.monthlyBalance || 0;
      const oldCurrentPlanId = client.currentPlanId?.toString() || null;

      AppLogger.logOperation('NEXT_WEEK_REQUEST_BALANCE_BEFORE', {
        clientId,
        oldBalance,
        oldMonthlyBalance,
        weeklyCost,
        willCharge: weeklyCost > 0,
      }, 'info');

      // 5. Charge balance (if weeklyCost > 0)
      if (weeklyCost > 0) {
        // Normalize nextPlan.planId to ObjectId for addPenaltyToBalance
        const nextPlanIdForPenalty = new Types.ObjectId(this.normalizePlanId(nextPlan.planId));
        await this.gamificationService.addPenaltyToBalance(
          new Types.ObjectId(clientId),
          weeklyCost,
          'Weekly plan cost - Unlocked next week',
          nextPlanIdForPenalty,
        );

        // Get updated balance after charging
        const updatedClient = await this.clientsService.getProfileById(clientId);
        const newBalance = updatedClient.balance || 0;
        const newMonthlyBalance = updatedClient.monthlyBalance || 0;

        AppLogger.logOperation('NEXT_WEEK_REQUEST_BALANCE_CHARGED', {
          clientId,
          planId: this.normalizePlanId(nextPlan.planId),
          weeklyCost,
          oldBalance,
          newBalance,
          oldMonthlyBalance,
          newMonthlyBalance,
          balanceIncrease: newBalance - oldBalance,
        }, 'info');
      } else {
        AppLogger.logOperation('NEXT_WEEK_REQUEST_BALANCE_SKIPPED', {
          clientId,
          planId: this.normalizePlanId(nextPlan.planId),
          reason: 'weeklyCost is 0',
        }, 'info');
      }

      // 6. Set currentPlanId (unlock the plan)
      await this.clientModel.findByIdAndUpdate(clientId, {
        $set: {
          currentPlanId: nextPlan.planId,
          nextWeekRequested: false, // Reset flag
          nextWeekRequestDate: null,
        }
      }).exec();

      AppLogger.logOperation('NEXT_WEEK_REQUEST_CURRENT_PLAN_UPDATED', {
        clientId,
        oldCurrentPlanId,
        newCurrentPlanId: nextPlan.planId.toString(),
        planName: plan.name,
      }, 'info');

      AppLogger.logOperation('NEXT_WEEK_REQUEST_UNLOCKED', {
        clientId,
        unlockedPlanId: nextPlan.planId.toString(),
        planName: plan.name,
      }, 'info');

      // 7. Get final client state to return
      const finalClient = await this.clientsService.getProfileById(clientId);
      const finalBalance = finalClient.balance || 0;
      const finalMonthlyBalance = finalClient.monthlyBalance || 0;
      const finalCurrentPlanId = finalClient.currentPlanId?.toString() || '';

      AppLogger.logOperation('NEXT_WEEK_REQUEST_RESPONSE_DATA', {
        clientId,
        currentPlanId: finalCurrentPlanId,
        balance: finalBalance,
        monthlyBalance: finalMonthlyBalance,
      }, 'info');

      AppLogger.logComplete('NEXT_WEEK_REQUEST', {
        clientId,
        unlockedPlanId: nextPlan.planId.toString(),
      });

      return {
        currentPlanId: finalCurrentPlanId,
        balance: finalBalance,
        monthlyBalance: finalMonthlyBalance,
      };
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

