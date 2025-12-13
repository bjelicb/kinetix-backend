import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkoutLog, WorkoutLogDocument } from './schemas/workout-log.schema';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';
import { ClientProfile } from '../clients/schemas/client-profile.schema';
import { WeeklyPlan } from '../plans/schemas/weekly-plan.schema';
import { ClientsService } from '../clients/clients.service';
import { PlansService } from '../plans/plans.service';
import { GamificationService } from '../gamification/gamification.service';
import { AppLogger } from '../common/utils/logger.utils';
import { DateUtils } from '../common/utils/date.utils';

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectModel(WorkoutLog.name)
    private workoutLogModel: Model<WorkoutLogDocument>,
    @Inject(forwardRef(() => ClientsService))
    private clientsService: ClientsService,
    @Inject(forwardRef(() => PlansService))
    private plansService: PlansService,
    @Inject(forwardRef(() => GamificationService))
    private gamificationService: GamificationService,
  ) {}

  async generateWeeklyLogs(
    client: ClientProfile,
    plan: WeeklyPlan,
    startDate: Date,
  ): Promise<WorkoutLog[]> {
    const clientProfileId = (client as any)._id || (client as any).id;
    const planId = (plan as any)._id || (plan as any).id;
    
    AppLogger.logStart('WORKOUT_LOG_GENERATE', {
      clientId: clientProfileId?.toString(),
      planId: planId?.toString(),
      startDate: startDate.toISOString(),
    });

    try {
      const logs: WorkoutLog[] = [];
      // Use DateUtils for consistent UTC normalization
      const weekStartDate = DateUtils.normalizeToStartOfDay(new Date(startDate));

      // Validate plan has workouts
      const planWorkouts = (plan as any).workouts || plan.workouts;
      if (!planWorkouts || !Array.isArray(planWorkouts)) {
        throw new Error(`Plan does not have valid workouts array. Plan ID: ${planId}`);
      }

      // Get client profile ID (not userId)
      if (!clientProfileId) {
        throw new Error('Client profile ID is missing');
      }

      // Get trainer profile ID - handle both populated and non-populated cases
      if (!client.trainerId) {
        throw new Error(`Client does not have a trainer assigned. Client ID: ${clientProfileId}`);
      }
      let trainerProfileId: Types.ObjectId | string = client.trainerId;
      
      // Convert to ObjectId string if needed
      let trainerProfileIdString: string;
      if ((trainerProfileId as any)?._id) {
        trainerProfileIdString = (trainerProfileId as any)._id.toString();
      } else if (typeof trainerProfileId === 'string') {
        trainerProfileIdString = trainerProfileId;
      } else if (trainerProfileId instanceof Types.ObjectId) {
        trainerProfileIdString = trainerProfileId.toString();
      } else {
        trainerProfileIdString = String(trainerProfileId);
      }

      // Validate trainerProfileId is a valid ObjectId string
      if (!Types.ObjectId.isValid(trainerProfileIdString)) {
        throw new Error(`Invalid trainer ID format: ${trainerProfileIdString}`);
      }

      // Validate plan ID (already extracted at start of method)
      if (!planId) {
        throw new Error('Plan ID is missing');
      }

      // Generate 7 WorkoutLog documents (one per day)
      for (let day = 0; day < 7; day++) {
        // Use DateUtils.addDays for consistent UTC date arithmetic
        const workoutDate = DateUtils.addDays(weekStartDate, day);
        // Ensure it's normalized to start of day (addDays already handles this, but be explicit)
        const normalizedWorkoutDate = DateUtils.normalizeToStartOfDay(workoutDate);
        
        const workoutDateEnd = DateUtils.normalizeToEndOfDay(normalizedWorkoutDate);

        AppLogger.logOperation('WORKOUT_LOG_DUPLICATE_CHECK', {
          clientId: clientProfileId.toString(),
          workoutDate: workoutDate.toISOString(),
          day,
        }, 'debug');

        // Check if log already exists for this specific date using MongoDB query
        // Note: MongoDB index is on clientId_1_workoutDate_1, so we check without weeklyPlanId
        const existingLog = await this.workoutLogModel.findOne({
          clientId: new Types.ObjectId(clientProfileId),
          workoutDate: {
            $gte: normalizedWorkoutDate,
            $lt: workoutDateEnd,
          },
        }).exec();

        if (existingLog) {
          AppLogger.logWarning('WORKOUT_LOG_DUPLICATE_FOUND', {
            clientId: clientProfileId.toString(),
            workoutDate: normalizedWorkoutDate.toISOString(),
            existingLogId: existingLog._id.toString(),
            action: 'Updating existing log',
          });
          
          // Update existing log with new plan data
          existingLog.weeklyPlanId = new Types.ObjectId(planId);
          existingLog.trainerId = new Types.ObjectId(trainerProfileIdString);
          
          // Normalize workoutDate to UTC (fixes old logs with 23:00:00.000Z)
          const existingDate = new Date(existingLog.workoutDate);
          const existingNormalized = DateUtils.normalizeToStartOfDay(existingDate);
          if (existingDate.getTime() !== existingNormalized.getTime()) {
            console.log(`[WorkoutsService] → Normalizing workoutDate from ${existingDate.toISOString()} to ${existingNormalized.toISOString()}`);
            existingLog.workoutDate = existingNormalized;
          } else {
            // Ensure it's set to normalized date even if already correct
            existingLog.workoutDate = normalizedWorkoutDate;
          }
          
          const planDayIndex = day + 1; // Plan day index (1-7)
          const planWorkout = planWorkouts.find((w: any) => w.dayOfWeek === planDayIndex) || null;
          console.log(`[WorkoutsService] → Day ${day + 1}/7: planDayIndex=${planDayIndex}, workoutDate=${normalizedWorkoutDate.toISOString()}, planWorkout=${planWorkout ? planWorkout.name : 'null'}`);
          
          if (planWorkout && planWorkout.exercises && Array.isArray(planWorkout.exercises) && planWorkout.exercises.length > 0) {
            existingLog.completedExercises = planWorkout.exercises.map((ex: any) => ({
              exerciseName: ex.name || ex.exerciseName || 'Unknown',
              actualSets: ex.sets || 0,
              actualReps: [],
              weightUsed: undefined,
              notes: undefined,
            }));
          }
          
          existingLog.dayOfWeek = planDayIndex;
          await existingLog.save();
          continue;
        }

        AppLogger.logOperation('WORKOUT_LOG_NEW_CREATED', {
          clientId: clientProfileId.toString(),
          workoutDate: normalizedWorkoutDate.toISOString(),
          day,
        }, 'debug');

        const planDayIndex = day + 1; // Plan day index (1-7)
        console.log(`[WorkoutsService] → Day ${day + 1}/7: planDayIndex=${planDayIndex}, workoutDate=${normalizedWorkoutDate.toISOString()}`);

        // Find workout for this day from plan
        const planWorkout = planWorkouts.find((w: any) => w.dayOfWeek === planDayIndex) || null;

        // Build completedExercises array
        let completedExercises: any[] = [];
        if (planWorkout && planWorkout.exercises && Array.isArray(planWorkout.exercises) && planWorkout.exercises.length > 0) {
          completedExercises = planWorkout.exercises.map((ex: any) => ({
            exerciseName: ex.name || ex.exerciseName || 'Unknown',
            actualSets: ex.sets || 0,
            actualReps: [], // Empty array for initial state
            weightUsed: undefined,
            notes: undefined,
          }));
        }
        
        const log = new this.workoutLogModel({
          clientId: new Types.ObjectId(clientProfileId),
          trainerId: new Types.ObjectId(trainerProfileIdString),
          weeklyPlanId: new Types.ObjectId(planId),
          workoutDate: normalizedWorkoutDate,
          weekNumber: 1, // First week
          dayOfWeek: planDayIndex,
          isCompleted: false,
          isMissed: planWorkout?.isRestDay === true ? false : false, // Not missed initially
          completedExercises,
        });

        logs.push(log);
      }

      // Save all logs (only if there are new ones to create)
      if (logs.length > 0) {
        // Log details about each workout log being created
        console.log(`[WorkoutsService] 📝 Creating ${logs.length} workout logs for client ${clientProfileId.toString()}:`);
        logs.forEach((log, index) => {
          const logDate = log.workoutDate.toISOString().split('T')[0];
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][log.dayOfWeek === 7 ? 0 : log.dayOfWeek];
          const exerciseCount = log.completedExercises?.length || 0;
          console.log(`[WorkoutsService]   ${index + 1}. Day ${log.dayOfWeek} (${dayName}) - ${logDate} - ${exerciseCount} exercises`);
        });
        
        AppLogger.logOperation('WORKOUT_LOG_GENERATE_COMPLETE', {
          clientId: clientProfileId.toString(),
          planId: planId.toString(),
          totalLogsCreated: logs.length,
        }, 'info');
        
        try {
          const insertedLogs = await this.workoutLogModel.insertMany(logs, { ordered: false });
          console.log(`[WorkoutsService] ✅ Successfully created ${insertedLogs.length} workout logs for client ${clientProfileId.toString()}`);
          return insertedLogs;
        } catch (error: any) {
          // If it's a duplicate key error, some documents may have been inserted successfully
          // With ordered: false, MongoDB continues inserting even if some fail
          if (error.code === 11000) {
            // Check if any documents were successfully inserted
            if (error.result && error.result.insertedCount > 0) {
              // Some documents were inserted, return those by querying the database
              const insertedIds = Object.values(error.result.insertedIds || {}) as (Types.ObjectId | string)[];
              if (insertedIds.length > 0) {
                // Convert to ObjectId array for query
                const objectIds = insertedIds.map(id => 
                  id instanceof Types.ObjectId ? id : new Types.ObjectId(id)
                );
                return await this.workoutLogModel.find({
                  _id: { $in: objectIds },
                }).exec();
              }
            }
            // All documents were duplicates or none were inserted, return empty array (logs already exist)
            return [];
          }
          // For other errors, throw
          throw error;
        }
      }
      return [];
    } catch (error) {
      console.error('Error in generateWeeklyLogs:', error);
      throw error;
    }
  }

  async logWorkout(userId: string, dto: LogWorkoutDto, userRole?: string): Promise<WorkoutLog> {
    // Get client profile to get clientProfileId
    const client = await this.clientsService.getProfile(userId);
    const clientProfileId = (client as any)._id;
    
    const workoutDate = new Date(dto.workoutDate);

    AppLogger.logStart('WORKOUT_COMPLETE', {
      clientId: clientProfileId.toString(),
      workoutDate: workoutDate.toISOString(),
      weeklyPlanId: dto.weeklyPlanId,
      userRole: userRole || 'CLIENT',
    });

    // Validate workout date (only for CLIENT role)
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    AppLogger.logOperation('WORKOUT_DATE_VALIDATE', {
      clientId: clientProfileId.toString(),
      workoutDate: workoutDate.toISOString(),
      today: today.toISOString(),
      thirtyDaysAgo: thirtyDaysAgo.toISOString(),
      userRole: userRole || 'CLIENT',
    }, 'debug');

    if (!userRole || userRole === 'CLIENT') {
      // Don't allow future dates
      if (workoutDate > today) {
        AppLogger.logWarning('WORKOUT_DATE_FUTURE', {
          clientId: clientProfileId.toString(),
          workoutDate: workoutDate.toISOString(),
          today: today.toISOString(),
          reason: 'Cannot log workout for future dates',
        });
        throw new Error(
          'Cannot log workout for future dates. Please log workouts on or before their scheduled date.'
        );
      }

      // Don't allow workouts older than 30 days
      if (workoutDate < thirtyDaysAgo) {
        AppLogger.logWarning('WORKOUT_DATE_TOO_OLD', {
          clientId: clientProfileId.toString(),
          workoutDate: workoutDate.toISOString(),
          thirtyDaysAgo: thirtyDaysAgo.toISOString(),
          reason: 'Cannot log workouts older than 30 days',
        });
        throw new Error(
          'Cannot log workouts older than 30 days. Please contact your trainer if you need to log past workouts.'
        );
      }

      AppLogger.logOperation('WORKOUT_DATE_VALID', {
        clientId: clientProfileId.toString(),
        workoutDate: workoutDate.toISOString(),
      }, 'debug');
    } else {
      AppLogger.logOperation('WORKOUT_DATE_BYPASS', {
        clientId: clientProfileId.toString(),
        workoutDate: workoutDate.toISOString(),
        userRole,
        reason: 'Trainer/Admin can log any date',
      }, 'debug');
    }

    // Check if log already exists
    const existingLog = await this.workoutLogModel.findOne({
      clientId: new Types.ObjectId(clientProfileId),
      workoutDate,
    }).exec();

    if (existingLog) {
      // Validate rest day - check if workout is marked as rest day
      const plan = await this.workoutLogModel.findById(existingLog._id)
        .populate('weeklyPlanId')
        .exec();
      
      if (plan && (plan as any).weeklyPlanId) {
        const weeklyPlan = (plan as any).weeklyPlanId;
        const dayOfWeek = workoutDate.getDay() === 0 ? 7 : workoutDate.getDay();
        const workoutDay = weeklyPlan.workouts?.find((w: any) => w.dayOfWeek === dayOfWeek);
        
        if (workoutDay?.isRestDay) {
          AppLogger.logWarning('WORKOUT_REST_DAY_BLOCKED', {
            clientId: clientProfileId.toString(),
            workoutDate: workoutDate.toISOString(),
            dayOfWeek,
            reason: 'Cannot log workout on rest day',
          });
          throw new Error('Cannot log workout on rest day. This day is scheduled as a rest day.');
        }
        
        AppLogger.logOperation('WORKOUT_REST_DAY_CHECK', {
          clientId: clientProfileId.toString(),
          workoutDate: workoutDate.toISOString(),
          dayOfWeek,
          isRestDay: false,
        }, 'debug');
      }

      // Check for multiple workouts same day
      const sameDayStart = DateUtils.normalizeToStartOfDay(workoutDate);
      const sameDayEnd = DateUtils.normalizeToEndOfDay(workoutDate);
      
      const existingWorkoutsCount = await this.workoutLogModel.countDocuments({
        clientId: new Types.ObjectId(clientProfileId),
        workoutDate: {
          $gte: sameDayStart,
          $lte: sameDayEnd,
        },
        isCompleted: true,
      }).exec();

      AppLogger.logOperation('WORKOUT_SAME_DAY_CHECK', {
        clientId: clientProfileId.toString(),
        workoutDate: workoutDate.toISOString(),
        existingCompletedCount: existingWorkoutsCount,
      }, 'debug');

      if (existingWorkoutsCount > 0) {
        AppLogger.logWarning('WORKOUT_SAME_DAY_FOUND', {
          clientId: clientProfileId.toString(),
          workoutDate: workoutDate.toISOString(),
          count: existingWorkoutsCount,
          action: 'Allowing - updating existing log',
        });
      }
      
      // If first completion, set workoutStartTime
      // If first completion, set workoutStartTime
      if (!existingLog.workoutStartTime && !existingLog.isCompleted) {
        existingLog.workoutStartTime = new Date();
        AppLogger.logOperation('WORKOUT_START_TIME_SET', {
          workoutLogId: existingLog._id.toString(),
          workoutStartTime: existingLog.workoutStartTime.toISOString(),
        }, 'debug');
      }
      
      // Update existing log
      existingLog.completedExercises = dto.completedExercises || [];
      existingLog.isCompleted = dto.isCompleted ?? true;
      const completedAt = dto.completedAt
        ? new Date(dto.completedAt)
        : new Date();
      existingLog.completedAt = completedAt;
      existingLog.difficultyRating = dto.difficultyRating;
      existingLog.clientNotes = dto.clientNotes;

      // Validate completion time (minimum 5 minutes)
      if (existingLog.workoutStartTime && existingLog.isCompleted) {
        const minimumDurationMs = 5 * 60 * 1000; // 5 minutes
        const durationMs = completedAt.getTime() - existingLog.workoutStartTime.getTime();
        const durationMinutes = Math.round(durationMs / 60000);

        AppLogger.logOperation('WORKOUT_COMPLETE_DURATION', {
          workoutLogId: existingLog._id.toString(),
          durationMs,
          durationMinutes,
          minimumMinutes: 5,
        }, 'debug');

        if (durationMs < minimumDurationMs) {
          existingLog.suspiciousCompletion = true;
          AppLogger.logWarning('WORKOUT_COMPLETE_SUSPICIOUS', {
            workoutLogId: existingLog._id.toString(),
            clientId: clientProfileId.toString(),
            durationSeconds: Math.round(durationMs / 1000),
            durationMinutes,
            minimumMinutes: 5,
            reason: 'Workout completed too quickly',
          });
        } else {
          AppLogger.logOperation('WORKOUT_COMPLETE_NORMAL', {
            workoutLogId: existingLog._id.toString(),
            durationMinutes,
          }, 'debug');
        }
      }

      await existingLog.save();
      AppLogger.logComplete('WORKOUT_COMPLETE', {
        workoutLogId: existingLog._id.toString(),
        clientId: clientProfileId.toString(),
        suspiciousCompletion: existingLog.suspiciousCompletion,
      });
      
      return existingLog;
    }

    // Create new log
    // Get trainerId from client profile
    const trainerId = client.trainerId;
    if (!trainerId) {
      throw new Error(`Client does not have a trainer assigned. Client ID: ${clientProfileId}`);
    }
    const trainerIdString = (trainerId as any)?._id 
      ? (trainerId as any)._id.toString() 
      : trainerId.toString();

    const workoutStartTime = new Date();
    const completedAt = dto.completedAt ? new Date(dto.completedAt) : new Date();
    
    AppLogger.logOperation('WORKOUT_START_TIME_SET', {
      clientId: clientProfileId.toString(),
      workoutStartTime: workoutStartTime.toISOString(),
    }, 'debug');

    const log = new this.workoutLogModel({
      clientId: new Types.ObjectId(clientProfileId),
      trainerId: new Types.ObjectId(trainerIdString),
      weeklyPlanId: new Types.ObjectId(dto.weeklyPlanId),
      workoutDate,
      dayOfWeek: dto.dayOfWeek,
      completedExercises: dto.completedExercises || [],
      isCompleted: dto.isCompleted ?? true,
      completedAt,
      workoutStartTime,
      suspiciousCompletion: false, // New logs can't be suspicious (just created)
      difficultyRating: dto.difficultyRating,
      clientNotes: dto.clientNotes,
    });

    await log.save();
    
    AppLogger.logComplete('WORKOUT_COMPLETE', {
      workoutLogId: log._id.toString(),
      clientId: clientProfileId.toString(),
      suspiciousCompletion: false,
    });

    return log;
  }

  async updateWorkoutLog(
    logId: string,
    dto: UpdateWorkoutLogDto,
  ): Promise<WorkoutLog> {
    // First, get the existing log to check if isMissed is changing
    const existingLog = await this.workoutLogModel.findById(logId).exec();
    if (!existingLog) {
      throw new NotFoundException('Workout log not found');
    }

    const updateData: any = {};

    if (dto.completedExercises) {
      updateData.completedExercises = dto.completedExercises;
    }

    if (dto.isCompleted !== undefined) {
      updateData.isCompleted = dto.isCompleted;
    }

    if (dto.completedAt) {
      updateData.completedAt = new Date(dto.completedAt);
    }

    if (dto.difficultyRating) {
      updateData.difficultyRating = dto.difficultyRating;
    }

    if (dto.clientNotes !== undefined) {
      updateData.clientNotes = dto.clientNotes;
    }

    // Check if isMissed is being set to true (and wasn't already true)
    if (dto.isMissed !== undefined) {
      updateData.isMissed = dto.isMissed;
      
      // If marking as missed and it wasn't already missed, add penalty
      if (dto.isMissed === true && existingLog.isMissed === false) {
        console.log(`[WorkoutsService] updateWorkoutLog - Workout ${logId} is being marked as missed, adding penalty`);
        try {
          await this.gamificationService.addPenaltyToBalance(
            existingLog.clientId.toString(),
            1, // 1€ per missed workout
            'Missed workout penalty',
            existingLog.weeklyPlanId,
          );
          console.log(`[WorkoutsService] updateWorkoutLog - Successfully added 1€ penalty for missed workout ${logId}`);
        } catch (error) {
          console.error(`[WorkoutsService] updateWorkoutLog - Error adding penalty for missed workout ${logId}:`, error);
          // Don't throw - workout update should succeed even if penalty fails
        }
      }
    }

    const log = await this.workoutLogModel
      .findByIdAndUpdate(logId, { $set: updateData }, { new: true })
      .exec();

    if (!log) {
      throw new NotFoundException('Workout log not found');
    }

    return log;
  }

  async getTodayWorkout(userId: string): Promise<WorkoutLog | null> {
    // Get client profile to get clientProfileId
    const client = await this.clientsService.getProfile(userId);
    const clientProfileId = (client as any)._id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.workoutLogModel
      .findOne({
        clientId: new Types.ObjectId(clientProfileId),
        workoutDate: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      })
      .select('clientId trainerId weeklyPlanId workoutDate weekNumber dayOfWeek completedExercises isCompleted isMissed completedAt difficultyRating clientNotes')
      .populate('weeklyPlanId', 'name workouts')
      .lean()
      .exec();
  }

  async getWorkoutById(logId: string): Promise<WorkoutLog> {
    const log = await this.workoutLogModel
      .findById(logId)
      .populate('weeklyPlanId', 'name workouts')
      .exec();

    if (!log) {
      throw new NotFoundException('Workout log not found');
    }

    return log;
  }

  async getWeekWorkouts(
    userId: string,
    date: Date,
  ): Promise<any[]> {
    // Get client profile - handle users without ClientProfile (e.g., ADMIN)
    let client;
    try {
      client = await this.clientsService.getProfile(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return [];
      }
      throw error;
    }
    
    const clientProfileId = (client as any)._id;
    
    // Find active plan and get date range + plan workouts
    let weeklyPlanIdFilter: Types.ObjectId | null = null;
    let planStartDate: Date | null = null;
    let planEndDate: Date | null = null;
    let planWorkouts: any[] = [];
    
    const activePlanEntry = this.clientsService.getActivePlanEntry(client);
    
    if (activePlanEntry) {
      const planId = (activePlanEntry.planId as any)?._id?.toString() || 
                     activePlanEntry.planId.toString();
      weeklyPlanIdFilter = new Types.ObjectId(planId);
      planStartDate = DateUtils.normalizeToStartOfDay(new Date(activePlanEntry.planStartDate));
      planEndDate = DateUtils.normalizeToEndOfDay(new Date(activePlanEntry.planEndDate));
      
      // Fetch plan to get workouts array
      try {
        const plan = await this.plansService.getPlanById(planId);
        planWorkouts = (plan as any).workouts || [];
      } catch (error) {
        console.error('[WorkoutsService] Error fetching plan:', error);
      }
    }
    
    // Build query - filter by PLAN date range, not week
    const query: any = {
      clientId: new Types.ObjectId(clientProfileId),
    };
    
    if (weeklyPlanIdFilter && planStartDate && planEndDate) {
      // Filter by active plan date range
      query.weeklyPlanId = weeklyPlanIdFilter;
      query.workoutDate = { $gte: planStartDate, $lte: planEndDate };
    } else {
      // Fallback: use week if no active plan
      const normalizedDate = DateUtils.normalizeToStartOfDay(new Date(date));
      const dayOfWeek = normalizedDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Convert to Monday
      const weekStart = DateUtils.addDays(normalizedDate, daysToMonday);
      const weekEnd = DateUtils.addDays(weekStart, 7);
      query.workoutDate = { $gte: weekStart, $lt: weekEnd };
    }
    
    const workouts = await this.workoutLogModel
      .find(query)
      .select('clientId trainerId weeklyPlanId workoutDate weekNumber dayOfWeek completedExercises isCompleted isMissed completedAt difficultyRating clientNotes updatedAt')
      .populate('weeklyPlanId', 'name workouts')
      .sort({ workoutDate: 1 })
      .lean()
      .exec();
    
    // Enrich each log with plan data
    const enrichedWorkouts = workouts.map((log: any) => {
      const planWorkout = planWorkouts.find((w: any) => w.dayOfWeek === log.dayOfWeek);
      
      return {
        ...log,
        workoutName: planWorkout?.name || 'Workout',
        isRestDay: planWorkout?.isRestDay || false,
        planExercises: planWorkout?.exercises || [],
      };
    });
    
    return enrichedWorkouts;
  }

  async getWorkoutHistory(clientId: string): Promise<WorkoutLog[]> {
    return this.workoutLogModel
      .find({
        clientId: new Types.ObjectId(clientId),
        isCompleted: true,
      })
      .select('clientId trainerId weeklyPlanId workoutDate weekNumber dayOfWeek completedExercises isCompleted isMissed completedAt difficultyRating clientNotes')
      .populate('weeklyPlanId', 'name')
      .sort({ workoutDate: -1 })
      .lean()
      .exec();
  }

  async getWorkoutLogsByClient(clientProfileId: string | Types.ObjectId): Promise<WorkoutLog[]> {
    return this.workoutLogModel
      .find({
        clientId: new Types.ObjectId(clientProfileId.toString()),
      })
      .select('clientId trainerId weeklyPlanId workoutDate weekNumber dayOfWeek completedExercises isCompleted isMissed completedAt difficultyRating clientNotes isRestDay')
      .populate('weeklyPlanId', 'name')
      .sort({ workoutDate: 1 })
      .lean()
      .exec();
  }

  async markMissedWorkouts(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all workouts that should be marked as missed
    const missedWorkouts = await this.workoutLogModel.find({
      workoutDate: { $lt: today },
      isCompleted: false,
      isMissed: false,
    }).exec();

    if (missedWorkouts.length === 0) {
      return 0;
    }

    // Group by clientId and weeklyPlanId to add penalties
    const clientPenalties = new Map<string, { clientId: Types.ObjectId; planId?: Types.ObjectId; count: number }>();
    
    for (const workout of missedWorkouts) {
      const clientId = workout.clientId.toString();
      const planId = workout.weeklyPlanId?.toString();
      
      if (!clientPenalties.has(clientId)) {
        clientPenalties.set(clientId, {
          clientId: workout.clientId,
          planId: planId ? new Types.ObjectId(planId) : undefined,
          count: 0,
        });
      }
      
      const entry = clientPenalties.get(clientId)!;
      entry.count += 1;
    }

    // Add 1€ penalty per missed workout to each client's balance
    console.log(`[WorkoutsService] markMissedWorkouts - Found ${missedWorkouts.length} missed workouts, affecting ${clientPenalties.size} clients`);
    
    for (const [clientIdStr, penalty] of clientPenalties.entries()) {
      try {
        console.log(`[WorkoutsService] Adding penalty for client ${clientIdStr}: ${penalty.count} missed workouts = ${penalty.count}€`);
        // Add 1€ for each missed workout
        for (let i = 0; i < penalty.count; i++) {
          await this.gamificationService.addPenaltyToBalance(
            penalty.clientId,
            1, // 1€ per missed workout
            'Missed workout',
            penalty.planId,
          );
        }
        console.log(`[WorkoutsService] Successfully added ${penalty.count}€ penalty for client ${clientIdStr}`);
      } catch (error) {
        console.error(`[WorkoutsService] Error adding penalty for client ${clientIdStr}:`, error);
        // Continue with other clients even if one fails
      }
    }

    // Mark workouts as missed
    const result = await this.workoutLogModel.updateMany(
      {
        workoutDate: { $lt: today },
        isCompleted: false,
        isMissed: false,
      },
      {
        $set: { isMissed: true },
      },
    ).exec();

    return result.modifiedCount;
  }

  /**
   * Mark all future/pending workouts for a plan as missed
   * Used when plan is changed/cancelled or overlaps with another plan
   * @param clientId Client profile ID
   * @param planId Plan ID
   * @param endDate Date when plan ends (future workouts from this date will be marked as missed)
   */
  async markMissedWorkoutsForPlan(
    clientId: string,
    planId: string,
    endDate: Date,
  ): Promise<void> {
    AppLogger.logStart('WORKOUT_CLEANUP', {
      clientId,
      planId,
      endDate: endDate.toISOString(),
    });

    try {
      const today = DateUtils.normalizeToStartOfDay(new Date());

      // Log query parameters
      AppLogger.logOperation('WORKOUT_CLEANUP_QUERY', {
        clientId,
        planId,
        today: today.toISOString(),
        endDate: endDate.toISOString(),
        criteria: 'workoutDate >= today, isCompleted = false, isMissed = false',
      }, 'debug');

      // Find all future/pending workouts for this plan
      const result = await this.workoutLogModel.updateMany(
        {
          clientId: new Types.ObjectId(clientId),
          weeklyPlanId: new Types.ObjectId(planId),
          workoutDate: { $gte: today },
          isCompleted: false,
          isMissed: false,
        },
        {
          $set: {
            isMissed: true,
            updatedAt: new Date(),
          }
        }
      ).exec();

      AppLogger.logWarning('WORKOUT_CLEANUP_MARKED', {
        clientId,
        planId,
        count: result.modifiedCount,
        reason: 'Plan changed or overlaps with new plan',
      });

      AppLogger.logComplete('WORKOUT_CLEANUP', {
        clientId,
        planId,
        markedCount: result.modifiedCount,
      });
    } catch (error) {
      AppLogger.logError('WORKOUT_CLEANUP', { clientId, planId }, error);
      throw error;
    }
  }

  /**
   * Delete uncompleted workout logs for a plan
   * Used when unassigning a plan from a client
   */
  async deleteUncompletedWorkoutsForPlan(
    clientProfileId: string,
    planId: string,
  ): Promise<number> {
    AppLogger.logStart('WORKOUT_DELETE_UNCOMPLETED', {
      clientProfileId,
      planId,
    });

    try {
      // Find all uncompleted workout logs for this plan
      const query = {
        clientId: new Types.ObjectId(clientProfileId),
        weeklyPlanId: new Types.ObjectId(planId),
        isCompleted: false,
        isMissed: false,
      };

      AppLogger.logOperation('WORKOUT_DELETE_UNCOMPLETED_QUERY', {
        clientProfileId,
        planId,
        criteria: 'isCompleted = false, isMissed = false',
      }, 'debug');

      // Count before deletion for logging
      const countBefore = await this.workoutLogModel.countDocuments(query).exec();
      
      AppLogger.logOperation('WORKOUT_DELETE_UNCOMPLETED_COUNT', {
        clientProfileId,
        planId,
        count: countBefore,
      }, 'debug');

      // Delete uncompleted workout logs
      const result = await this.workoutLogModel.deleteMany(query).exec();

      AppLogger.logOperation('WORKOUT_DELETE_UNCOMPLETED_DELETED', {
        clientProfileId,
        planId,
        deletedCount: result.deletedCount,
      }, 'info');

      AppLogger.logComplete('WORKOUT_DELETE_UNCOMPLETED', {
        clientProfileId,
        planId,
        deletedCount: result.deletedCount,
      });

      return result.deletedCount;
    } catch (error) {
      AppLogger.logError('WORKOUT_DELETE_UNCOMPLETED', { clientProfileId, planId }, error);
      throw error;
    }
  }
}

