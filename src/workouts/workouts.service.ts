import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
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
    private readonly clientsService: ClientsService,
    @Inject(forwardRef(() => PlansService))
    private readonly plansService: PlansService,
    @Inject(forwardRef(() => GamificationService))
    private readonly gamificationService: GamificationService,
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
    
    // Parse workoutDate as date-only (YYYY-MM-DD) to preserve the day regardless of timezone
    // Frontend sends date as ISO string (e.g., "2025-12-26T00:00:00.000"), we extract just the date part
    // This ensures that 2025-12-26 stays 2025-12-26, not 2025-12-25 due to UTC conversion
    const workoutDateString = dto.workoutDate.split('T')[0]; // Extract YYYY-MM-DD part
    const workoutDate = new Date(workoutDateString + 'T00:00:00.000Z'); // Parse as UTC date-only (no timezone shift)

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

    // OPTIONAL: Migration guard - check if duplicates exist before proceeding
    // This is a safety check to ensure migration was run before new code is used
    // Can be removed after migration is confirmed complete
    const duplicateCheck = await this.workoutLogModel.countDocuments({
      clientId: new Types.ObjectId(clientProfileId),
    }).exec();
    
    // Sample check: if there are many logs, check for potential duplicates
    // This is a lightweight check - full migration should have already run
    if (duplicateCheck > 100) {
      AppLogger.logOperation('MIGRATION_GUARD_CHECK', {
        clientId: clientProfileId.toString(),
        logCount: duplicateCheck,
        message: 'Many logs found - ensure migration was run',
      }, 'warn');
    }

    // Normalize workoutDate to start of day (consistent with generateWeeklyLogs)
    const normalizedWorkoutDate = DateUtils.normalizeToStartOfDay(workoutDate);
    const workoutDateEnd = DateUtils.normalizeToEndOfDay(normalizedWorkoutDate);

    // Check if log already exists using range query (consistent with generateWeeklyLogs)
    // ✅ IMPORTANT: Also check dayOfWeek and weeklyPlanId to ensure we find the correct workout log
    // This prevents updating a Rest Day log (dayOfWeek: 4) when finishing a Pull Day (dayOfWeek: 5)
    const existingLog = await this.workoutLogModel.findOne({
      clientId: new Types.ObjectId(clientProfileId),
      workoutDate: {
        $gte: normalizedWorkoutDate,
        $lt: workoutDateEnd,
      },
      dayOfWeek: dto.dayOfWeek, // ✅ Match dayOfWeek (plan day index 1-7)
      weeklyPlanId: new Types.ObjectId(dto.weeklyPlanId), // ✅ Match weeklyPlanId
    }).exec();

    // Edge case: Check if there's a conflicting log for the same date but different dayOfWeek/weeklyPlanId
    if (!existingLog) {
      const conflictingLog = await this.workoutLogModel.findOne({
        clientId: new Types.ObjectId(clientProfileId),
        workoutDate: {
          $gte: normalizedWorkoutDate,
          $lt: workoutDateEnd,
        },
      }).exec();

      if (conflictingLog) {
        AppLogger.logWarning('WORKOUT_CONFLICTING_LOG_FOUND', {
          clientId: clientProfileId.toString(),
          workoutDate: normalizedWorkoutDate.toISOString(),
          conflictingLogId: conflictingLog._id.toString(),
          conflictingDayOfWeek: conflictingLog.dayOfWeek,
          conflictingWeeklyPlanId: conflictingLog.weeklyPlanId.toString(),
          requestedDayOfWeek: dto.dayOfWeek,
          requestedWeeklyPlanId: dto.weeklyPlanId,
          action: 'Creating new log - dayOfWeek/weeklyPlanId mismatch',
        });
      }
    }

    if (existingLog) {
      // Rest day validation removed - allow finish/missed for all workouts including rest days
      // Use dto.dayOfWeek (plan day index 1-7) directly instead of calculating from workoutDate.getDay()

      // ✅ Detailed logging for debugging
      const dayOfWeekMatch = existingLog.dayOfWeek === dto.dayOfWeek;
      const weeklyPlanIdMatch = existingLog.weeklyPlanId.toString() === dto.weeklyPlanId;
      AppLogger.logOperation('WORKOUT_EXISTING_LOG_FOUND', {
        clientId: clientProfileId.toString(),
        workoutDate: normalizedWorkoutDate.toISOString(),
        existingLogId: existingLog._id.toString(),
        existingDayOfWeek: existingLog.dayOfWeek,
        existingWeeklyPlanId: existingLog.weeklyPlanId.toString(),
        requestedDayOfWeek: dto.dayOfWeek,
        requestedWeeklyPlanId: dto.weeklyPlanId,
        dayOfWeekMatch,
        weeklyPlanIdMatch,
        match: dayOfWeekMatch && weeklyPlanIdMatch,
      }, 'debug');

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
      
      // ✅ KRITIČNO: Ako je workout completed, isMissed MORA biti false
      // Ovo osigurava data consistency - workout ne može biti completed I missed istovremeno
      if (existingLog.isCompleted) {
        existingLog.isMissed = false;
        AppLogger.logOperation('WORKOUT_COMPLETE_RESET_MISSED', {
          workoutLogId: existingLog._id.toString(),
          previousIsMissed: existingLog.isMissed,
          message: 'Reset isMissed to false because workout is completed',
        }, 'debug');
      }
      
      const completedAt = dto.completedAt
        ? new Date(dto.completedAt)
        : new Date();
      existingLog.completedAt = completedAt;
      existingLog.difficultyRating = dto.difficultyRating;
      existingLog.clientNotes = dto.clientNotes;
      // ✅ Also update dayOfWeek, weeklyPlanId, and workoutDate to ensure consistency
      existingLog.dayOfWeek = dto.dayOfWeek;
      existingLog.weeklyPlanId = new Types.ObjectId(dto.weeklyPlanId);
      existingLog.workoutDate = normalizedWorkoutDate; // ✅ Update workoutDate to match requested date

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
      
      // ✅ Enrich log with workoutName and planExercises before returning
      return await this.enrichWorkoutLog(existingLog);
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

    const isCompleted = dto.isCompleted ?? true;
    
    const log = new this.workoutLogModel({
      clientId: new Types.ObjectId(clientProfileId),
      trainerId: new Types.ObjectId(trainerIdString),
      weeklyPlanId: new Types.ObjectId(dto.weeklyPlanId),
      workoutDate: normalizedWorkoutDate, // ✅ Use normalized date
      dayOfWeek: dto.dayOfWeek,
      completedExercises: dto.completedExercises || [],
      isCompleted,
      isMissed: isCompleted ? false : false, // ✅ KRITIČNO: Ako je completed, isMissed MORA biti false
      completedAt,
      workoutStartTime,
      suspiciousCompletion: false, // New logs can't be suspicious (just created)
      difficultyRating: dto.difficultyRating,
      clientNotes: dto.clientNotes,
    });

    try {
      await log.save();
      
      AppLogger.logComplete('WORKOUT_COMPLETE', {
        workoutLogId: log._id.toString(),
        clientId: clientProfileId.toString(),
        suspiciousCompletion: false,
      });

      // ✅ Enrich log with workoutName and planExercises before returning
      return await this.enrichWorkoutLog(log);
    } catch (error: any) {
      // Handle unique index violation (duplicate workoutDate after normalization)
      // This can happen if there's a conflicting log with different dayOfWeek for the same date
      if (error.code === 11000) {
        AppLogger.logWarning('WORKOUT_COMPLETE_DUPLICATE', {
          clientId: clientProfileId.toString(),
          workoutDate: normalizedWorkoutDate.toISOString(),
          error: 'Unique index violation - duplicate workoutDate detected',
          action: 'Attempting to update existing conflicting log',
        });

        // Find existing log with same clientId and workoutDate (but different dayOfWeek)
        const existingConflictingLog = await this.workoutLogModel.findOne({
          clientId: new Types.ObjectId(clientProfileId),
          workoutDate: {
            $gte: normalizedWorkoutDate,
            $lt: workoutDateEnd,
          },
        }).exec();

        if (existingConflictingLog) {
          AppLogger.logOperation('WORKOUT_COMPLETE_MERGE', {
            existingLogId: existingConflictingLog._id.toString(),
            existingDayOfWeek: existingConflictingLog.dayOfWeek,
            existingWeeklyPlanId: existingConflictingLog.weeklyPlanId.toString(),
            requestedDayOfWeek: dto.dayOfWeek,
            requestedWeeklyPlanId: dto.weeklyPlanId,
            message: 'Updating existing conflicting log with new dayOfWeek and weeklyPlanId',
          }, 'warn');

          // Update existing log with new data (including dayOfWeek, weeklyPlanId, and workoutDate)
          existingConflictingLog.dayOfWeek = dto.dayOfWeek;
          existingConflictingLog.weeklyPlanId = new Types.ObjectId(dto.weeklyPlanId);
          existingConflictingLog.workoutDate = normalizedWorkoutDate; // ✅ Update workoutDate to match requested date
          existingConflictingLog.completedExercises = dto.completedExercises || [];
          existingConflictingLog.isCompleted = dto.isCompleted ?? true;
          existingConflictingLog.completedAt = completedAt;
          existingConflictingLog.workoutStartTime = workoutStartTime;
          existingConflictingLog.suspiciousCompletion = false;
          existingConflictingLog.difficultyRating = dto.difficultyRating;
          existingConflictingLog.clientNotes = dto.clientNotes;

          await existingConflictingLog.save();

          AppLogger.logComplete('WORKOUT_COMPLETE', {
            workoutLogId: existingConflictingLog._id.toString(),
            clientId: clientProfileId.toString(),
            suspiciousCompletion: false,
          });

          // ✅ Enrich log with workoutName and planExercises before returning
          return await this.enrichWorkoutLog(existingConflictingLog);
        } else {
          // Should not happen, but handle gracefully
          AppLogger.logWarning('WORKOUT_COMPLETE_DUPLICATE_NO_LOG', {
            clientId: clientProfileId.toString(),
            workoutDate: normalizedWorkoutDate.toISOString(),
            error: 'Unique constraint violation but no conflicting log found',
          });
          throw new Error('Failed to create workout log: unique constraint violation');
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  }

  async updateWorkoutLog(
    logId: string,
    dto: UpdateWorkoutLogDto,
    userId: string,
  ): Promise<WorkoutLog> {
    // First, get the existing log to check if isMissed is changing
    const existingLog = await this.workoutLogModel.findById(logId).exec();
    if (!existingLog) {
      throw new NotFoundException('Workout log not found');
    }

    // ✅ SECURITY: Verify that the workout log belongs to the authenticated user
    const client = await this.clientsService.getProfile(userId);
    const clientProfileId = (client as any)._id.toString();
    const logClientId = existingLog.clientId.toString();

    if (logClientId !== clientProfileId) {
      throw new ForbiddenException('You do not have permission to update this workout log');
    }

    const updateData: any = {};

    if (dto.completedExercises) {
      updateData.completedExercises = dto.completedExercises;
    }

    if (dto.isCompleted !== undefined) {
      updateData.isCompleted = dto.isCompleted;
      
      // ✅ KRITIČNO: Ako je workout completed, isMissed MORA biti false
      // Ovo osigurava data consistency - workout ne može biti completed I missed istovremeno
      if (dto.isCompleted === true) {
        updateData.isMissed = false;
        AppLogger.logOperation('UPDATE_WORKOUT_LOG_RESET_MISSED', {
          logId,
          previousIsMissed: existingLog.isMissed,
          message: 'Reset isMissed to false because workout is being completed',
        }, 'debug');
      }
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

    // Normalize workoutDate if it's being updated (CRITICAL: findByIdAndUpdate doesn't trigger pre-save hook)
    if (dto.workoutDate) {
      updateData.workoutDate = DateUtils.normalizeToStartOfDay(new Date(dto.workoutDate));
      AppLogger.logOperation('UPDATE_WORKOUT_LOG_NORMALIZE_DATE', {
        logId,
        originalDate: dto.workoutDate,
        normalizedDate: updateData.workoutDate.toISOString(),
      }, 'debug');
    }

    // Check if isMissed is being set to true (and wasn't already true)
    if (dto.isMissed !== undefined) {
      updateData.isMissed = dto.isMissed;
      
      // If marking as missed and it wasn't already missed, add penalty and reset completedExercises
      if (dto.isMissed === true && existingLog.isMissed === false) {
        AppLogger.logOperation('UPDATE_WORKOUT_LOG_MARK_MISSED', {
          logId,
          clientId: existingLog.clientId.toString(),
          message: 'Workout is being marked as missed - resetting completedExercises and adding penalty',
        }, 'info');
        
        // ✅ Reset completedExercises when marking as missed (professional solution - backend handles it)
        updateData.completedExercises = [];
        updateData.isCompleted = false; // Also reset isCompleted flag
        
        AppLogger.logOperation('UPDATE_WORKOUT_LOG_RESET_EXERCISES', {
          logId,
          previousCompletedExercisesCount: existingLog.completedExercises?.length || 0,
          message: 'Reset completedExercises to empty array and isCompleted to false',
        }, 'debug');
        
        // Add penalty for missed workout
        try {
          await this.gamificationService.addPenaltyToBalance(
            existingLog.clientId.toString(),
            1, // 1€ per missed workout
            'Missed workout penalty',
            existingLog.weeklyPlanId,
          );
          AppLogger.logOperation('UPDATE_WORKOUT_LOG_PENALTY_ADDED', {
            logId,
            clientId: existingLog.clientId.toString(),
            penaltyAmount: 1,
          }, 'info');
        } catch (error) {
          AppLogger.logError('UPDATE_WORKOUT_LOG_PENALTY_ERROR', {
            logId,
            clientId: existingLog.clientId.toString(),
          }, error as Error);
          // Don't throw - workout update should succeed even if penalty fails
        }
      }
    }

    // Error handling for unique index violation (duplicate workoutDate after normalization)
    try {
      const log = await this.workoutLogModel
        .findByIdAndUpdate(logId, { $set: updateData }, { new: true })
        .exec();

      if (!log) {
        throw new NotFoundException('Workout log not found');
      }

      // ✅ Enrich log with workoutName and planExercises before returning (same as logWorkout)
      return await this.enrichWorkoutLog(log);
    } catch (error: any) {
      // Handle unique index violation (duplicate workoutDate after normalization)
      if (error.code === 11000) {
        AppLogger.logOperation('UPDATE_WORKOUT_LOG_DUPLICATE', {
          logId,
          error: 'Unique index violation - duplicate workoutDate detected',
        }, 'warn');
        
        // Try to find existing log with same clientId and normalized workoutDate
        const existingLogForMerge = await this.workoutLogModel.findById(logId).exec();
        if (existingLogForMerge && updateData.workoutDate) {
          const normalizedDate = DateUtils.normalizeToStartOfDay(updateData.workoutDate);
          const workoutDateEnd = DateUtils.normalizeToEndOfDay(normalizedDate);
          
          const existingLog = await this.workoutLogModel.findOne({
            _id: { $ne: new Types.ObjectId(logId) }, // Exclude current log
            clientId: existingLogForMerge.clientId,
            workoutDate: {
              $gte: normalizedDate,
              $lt: workoutDateEnd,
            },
          }).exec();

          if (existingLog) {
            AppLogger.logOperation('UPDATE_WORKOUT_LOG_MERGE', {
              logId,
              existingLogId: existingLog._id.toString(),
              message: 'Duplicate log found, updating existing instead',
            }, 'warn');
            
            // Update existing log instead (merge data)
            // ✅ Handle completedExercises reset when isMissed=true (same logic as main update)
            if (updateData.completedExercises !== undefined) {
              existingLog.completedExercises = updateData.completedExercises;
            }
            if (updateData.isCompleted !== undefined) existingLog.isCompleted = updateData.isCompleted;
            if (updateData.completedAt) existingLog.completedAt = updateData.completedAt;
            if (updateData.difficultyRating) existingLog.difficultyRating = updateData.difficultyRating;
            if (updateData.clientNotes !== undefined) existingLog.clientNotes = updateData.clientNotes;
            if (updateData.isMissed !== undefined) existingLog.isMissed = updateData.isMissed;
            if (updateData.workoutDate) existingLog.workoutDate = normalizedDate;
            
            await existingLog.save();
            
            // Delete the duplicate log that was being updated
            await this.workoutLogModel.findByIdAndDelete(logId).exec();
            
            // ✅ Enrich log with workoutName and planExercises before returning
            return await this.enrichWorkoutLog(existingLog);
          }
        }
      }
      
      // Re-throw if not a duplicate error or merge failed
      throw error;
    }
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

  async getWorkoutById(logId: string, userId: string): Promise<WorkoutLog> {
    const log = await this.workoutLogModel
      .findById(logId)
      .populate('weeklyPlanId', 'name workouts')
      .exec();

    if (!log) {
      throw new NotFoundException('Workout log not found');
    }

    // ✅ SECURITY: Verify that the workout log belongs to the authenticated user
    const client = await this.clientsService.getProfile(userId);
    const clientProfileId = (client as any)._id.toString();
    const logClientId = log.clientId.toString();

    if (logClientId !== clientProfileId) {
      throw new ForbiddenException('You do not have permission to access this workout log');
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
    
    const clientProfileId = (client as any)._id.toString();
    
    // Get ALL workout logs for this client (no plan filtering)
    console.log(`[WorkoutsService] getWeekWorkouts: Fetching ALL workout logs for client ${clientProfileId}`);
    
    const allWorkoutLogs = await this.getWorkoutLogsByClient(clientProfileId);
    
    console.log(`[WorkoutsService] getWeekWorkouts: Found ${allWorkoutLogs.length} total workout logs`);
    
    // Enrich each workout log with plan details
    const enrichedWorkouts = await Promise.all(
      allWorkoutLogs.map(async (log: any) => {
        const planId = (log.weeklyPlanId as any)?._id?.toString() || log.weeklyPlanId?.toString();
        
        if (!planId) {
          // No plan associated with this log
          // Ensure data consistency: if isCompleted is true, isMissed must be false
          const enrichedLog = {
            ...log,
            workoutName: 'Workout',
            isRestDay: false,
            planExercises: [],
            planName: 'No Plan',
          };
          return this.ensureWorkoutLogConsistency(enrichedLog);
        }
        
        try {
          // Fetch plan to get workout details
          // Note: userId is available in getWeekWorkouts method scope
          const plan = await this.plansService.getPlanById(planId, userId, 'CLIENT');
          const planWorkouts = (plan as any).workouts || [];
          
          // Find matching workout day in plan
          const planWorkout = planWorkouts.find((w: any) => w.dayOfWeek === log.dayOfWeek);
          
          // Ensure data consistency: if isCompleted is true, isMissed must be false
          const enrichedLog = {
            ...log,
            workoutName: planWorkout?.name || 'Workout',
            isRestDay: planWorkout?.isRestDay || false,
            planExercises: planWorkout?.exercises || [],
            planName: plan.name,
          };
          return this.ensureWorkoutLogConsistency(enrichedLog);
        } catch (error) {
          console.error(`[WorkoutsService] Error fetching plan ${planId}:`, error);
          // Plan might be deleted, return minimal data
          // Ensure data consistency: if isCompleted is true, isMissed must be false
          const enrichedLog = {
            ...log,
            workoutName: 'Workout',
            isRestDay: false,
            planExercises: [],
            planName: 'Deleted Plan',
          };
          return this.ensureWorkoutLogConsistency(enrichedLog);
        }
      })
    );
    
    console.log(`[WorkoutsService] getWeekWorkouts: Returning ${enrichedWorkouts.length} enriched workout logs`);
    
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

  /**
   * Helper function to ensure data consistency: if isCompleted is true, isMissed must be false
   * This guarantees consistent data even if database contains inconsistent state
   */
  private ensureWorkoutLogConsistency(log: any): any {
    // Log every call for debugging
    AppLogger.logOperation('WORKOUT_LOG_CONSISTENCY_CHECK', {
      logId: log._id?.toString(),
      workoutDate: log.workoutDate,
      isCompleted: log.isCompleted,
      isMissed: log.isMissed,
      message: `Checking consistency: isCompleted=${log.isCompleted}, isMissed=${log.isMissed}`,
    }, 'debug');
    
    if (log.isCompleted === true && log.isMissed === true) {
      AppLogger.logOperation('WORKOUT_LOG_CONSISTENCY_FIX', {
        logId: log._id?.toString(),
        workoutDate: log.workoutDate,
        message: 'Fixed inconsistent state: isCompleted=true but isMissed=true, setting isMissed=false',
      }, 'warn');
      return {
        ...log,
        isMissed: false,
      };
    }
    return log;
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

  /**
   * Enrich a single workout log with workoutName, isRestDay, and planExercises
   * This is used to ensure logWorkout returns enriched data for frontend
   */
  private async enrichWorkoutLog(log: any): Promise<any> {
    // Handle different weeklyPlanId formats: ObjectId, populated object, or string
    let planId: string | undefined;
    if (log.weeklyPlanId) {
      if (typeof log.weeklyPlanId === 'string') {
        planId = log.weeklyPlanId;
      } else if (log.weeklyPlanId._id) {
        planId = log.weeklyPlanId._id.toString();
      } else if (log.weeklyPlanId.toString) {
        planId = log.weeklyPlanId.toString();
      }
    }
    
    if (!planId) {
      // No plan associated with this log
      return {
        ...log.toObject ? log.toObject() : log,
        workoutName: 'Workout',
        isRestDay: false,
        planExercises: [],
      };
    }
    
    try {
      // Fetch plan to get workout details
      // Get userId from client profile using clientId from log
      const clientId = (log.clientId as any)?._id?.toString() || log.clientId?.toString() || log.clientId;
      if (!clientId) {
        // If no clientId, we can't verify ownership - skip enrichment
        return {
          ...log.toObject ? log.toObject() : log,
          workoutName: 'Workout',
          isRestDay: false,
          planExercises: [],
        };
      }
      
      // Get client profile to get userId
      const clientProfile = await this.clientsService.getProfileById(clientId);
      if (!clientProfile || !clientProfile.userId) {
        // If no client profile or userId, skip enrichment
        return {
          ...log.toObject ? log.toObject() : log,
          workoutName: 'Workout',
          isRestDay: false,
          planExercises: [],
        };
      }
      
      const clientUserId = (clientProfile.userId as any)?._id?.toString() || clientProfile.userId?.toString() || clientProfile.userId;
      const plan = await this.plansService.getPlanById(planId, clientUserId, 'CLIENT');
      const planWorkouts = (plan as any).workouts || [];
      
      // Find matching workout day in plan
      const planWorkout = planWorkouts.find((w: any) => w.dayOfWeek === log.dayOfWeek);
      
      return {
        ...log.toObject ? log.toObject() : log,
        workoutName: planWorkout?.name || 'Workout',
        isRestDay: planWorkout?.isRestDay || false,
        planExercises: planWorkout?.exercises || [],
      };
    } catch (error) {
      AppLogger.logError('ENRICH_WORKOUT_LOG_PLAN_ERROR', {
        logId: log._id?.toString(),
        planId,
      }, error as Error);
      // Plan might be deleted, return minimal data
      return {
        ...log.toObject ? log.toObject() : log,
        workoutName: 'Workout',
        isRestDay: false,
        planExercises: [],
      };
    }
  }

  /**
   * Get all workout logs for a client, enriched with workoutName and planExercises
   * Similar to getWeekWorkouts() but returns all logs without date filtering
   */
  async getAllWorkoutLogsEnriched(clientProfileId: string | Types.ObjectId): Promise<any[]> {
    AppLogger.logStart('GET_ALL_WORKOUT_LOGS_ENRICHED', {
      clientProfileId: clientProfileId.toString(),
    });

    const allWorkoutLogs = await this.getWorkoutLogsByClient(clientProfileId);
    
    AppLogger.logOperation('GET_ALL_WORKOUT_LOGS_ENRICHED_FOUND', {
      clientProfileId: clientProfileId.toString(),
      totalLogs: allWorkoutLogs.length,
    }, 'info');

    // Enrich each workout log with plan details (same logic as getWeekWorkouts)
    const enrichedWorkouts = await Promise.all(
      allWorkoutLogs.map(async (log: any) => {
        const planId = (log.weeklyPlanId as any)?._id?.toString() || log.weeklyPlanId?.toString();
        
        if (!planId) {
          // No plan associated with this log
          AppLogger.logOperation('GET_ALL_WORKOUT_LOGS_ENRICHED_NO_PLAN', {
            logId: log._id?.toString(),
            workoutDate: log.workoutDate,
          }, 'debug');
          // Ensure data consistency: if isCompleted is true, isMissed must be false
          const enrichedLog = {
            ...log,
            workoutName: 'Workout',
            isRestDay: false,
            planExercises: [],
          };
          return this.ensureWorkoutLogConsistency(enrichedLog);
        }
        
        try {
          // Fetch plan to get workout details
          // Get userId from client profile using clientId from log
          const clientId = (log.clientId as any)?._id?.toString() || log.clientId?.toString() || log.clientId;
          if (!clientId) {
            // If no clientId, skip enrichment
            // Ensure data consistency: if isCompleted is true, isMissed must be false
            const enrichedLog = {
              ...log,
              workoutName: 'Workout',
              isRestDay: false,
              planExercises: [],
            };
            return this.ensureWorkoutLogConsistency(enrichedLog);
          }
          
          // Get client profile to get userId
          const clientProfile = await this.clientsService.getProfileById(clientId);
          if (!clientProfile || !clientProfile.userId) {
            // If no client profile or userId, skip enrichment
            // Ensure data consistency: if isCompleted is true, isMissed must be false
            const enrichedLog = {
              ...log,
              workoutName: 'Workout',
              isRestDay: false,
              planExercises: [],
            };
            return this.ensureWorkoutLogConsistency(enrichedLog);
          }
          
          const clientUserId = (clientProfile.userId as any)?._id?.toString() || clientProfile.userId?.toString() || clientProfile.userId;
          const plan = await this.plansService.getPlanById(planId, clientUserId, 'CLIENT');
          const planWorkouts = (plan as any).workouts || [];
          
          // Find matching workout day in plan
          const planWorkout = planWorkouts.find((w: any) => w.dayOfWeek === log.dayOfWeek);
          
          AppLogger.logOperation('GET_ALL_WORKOUT_LOGS_ENRICHED_PLAN_FOUND', {
            logId: log._id?.toString(),
            planId,
            planName: plan.name,
            dayOfWeek: log.dayOfWeek,
            workoutName: planWorkout?.name || 'Workout',
            isRestDay: planWorkout?.isRestDay || false,
            exercisesCount: planWorkout?.exercises?.length || 0,
          }, 'debug');
          
          // Ensure data consistency: if isCompleted is true, isMissed must be false
          const enrichedLog = {
            ...log,
            workoutName: planWorkout?.name || 'Workout',
            isRestDay: planWorkout?.isRestDay || false,
            planExercises: planWorkout?.exercises || [],
          };
          return this.ensureWorkoutLogConsistency(enrichedLog);
        } catch (error) {
          AppLogger.logError('GET_ALL_WORKOUT_LOGS_ENRICHED_PLAN_ERROR', {
            logId: log._id?.toString(),
            planId,
          }, error as Error);
          // Plan might be deleted, return minimal data
          // Ensure data consistency: if isCompleted is true, isMissed must be false
          const enrichedLog = {
            ...log,
            workoutName: 'Workout',
            isRestDay: false,
            planExercises: [],
          };
          return this.ensureWorkoutLogConsistency(enrichedLog);
        }
      })
    );
    
    AppLogger.logComplete('GET_ALL_WORKOUT_LOGS_ENRICHED', {
      clientProfileId: clientProfileId.toString(),
      totalLogs: enrichedWorkouts.length,
    });

    return enrichedWorkouts;
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

  /**
   * Get analytics data for a specific client (Trainer view)
   * Calculates: total workouts, completed workouts, overall adherence, weekly adherence, strength progression
   * 
   * @param clientProfileId Client profile ID
   * @returns Analytics data object
   */
  async getClientAnalytics(clientProfileId: string): Promise<{
    totalWorkouts: number;
    completedWorkouts: number;
    overallAdherence: number;
    weeklyAdherence: number[];
    strengthProgression: Record<string, Array<{ x: number; y: number }>>;
  }> {
    AppLogger.logStart('CLIENT_ANALYTICS_GET', { clientProfileId });

    try {
      // Get all workout logs for client
      AppLogger.logOperation('CLIENT_ANALYTICS_FETCH_WORKOUTS', { clientProfileId }, 'debug');
      const workoutLogs = await this.getAllWorkoutLogsEnriched(clientProfileId);
      AppLogger.logOperation('CLIENT_ANALYTICS_WORKOUTS_FETCHED', {
        clientProfileId,
        totalWorkouts: workoutLogs.length,
      }, 'debug');

      // Calculate basic metrics
      const totalWorkouts = workoutLogs.length;
      const completedWorkouts = workoutLogs.filter((log: any) => log.isCompleted).length;
      const overallAdherence = totalWorkouts > 0 
        ? Math.round((completedWorkouts / totalWorkouts) * 100 * 100) / 100 
        : 0;

      AppLogger.logOperation('CLIENT_ANALYTICS_BASIC_METRICS', {
        clientProfileId,
        totalWorkouts,
        completedWorkouts,
        overallAdherence,
      }, 'debug');

      // Calculate weekly adherence (current week: Monday to Sunday)
      AppLogger.logOperation('CLIENT_ANALYTICS_CALCULATE_WEEKLY', { clientProfileId }, 'debug');
      const weeklyAdherence = this.calculateWeeklyAdherence(workoutLogs);
      AppLogger.logOperation('CLIENT_ANALYTICS_WEEKLY_CALCULATED', {
        clientProfileId,
        weeklyAdherence,
      }, 'debug');

      // Calculate strength progression (last 30 days)
      AppLogger.logOperation('CLIENT_ANALYTICS_CALCULATE_STRENGTH', { clientProfileId, daysBack: 30 }, 'debug');
      const strengthProgression = this.calculateStrengthProgression(workoutLogs, 30);
      AppLogger.logOperation('CLIENT_ANALYTICS_STRENGTH_CALCULATED', {
        clientProfileId,
        exercisesCount: Object.keys(strengthProgression).length,
        exercises: Object.keys(strengthProgression),
      }, 'debug');

      AppLogger.logComplete('CLIENT_ANALYTICS_GET', {
        clientProfileId,
        totalWorkouts,
        completedWorkouts,
        overallAdherence,
        weeklyAdherenceLength: weeklyAdherence.length,
        strengthProgressionExercises: Object.keys(strengthProgression).length,
      });

      return {
        totalWorkouts,
        completedWorkouts,
        overallAdherence,
        weeklyAdherence,
        strengthProgression,
      };
    } catch (error) {
      AppLogger.logError('CLIENT_ANALYTICS_GET', { clientProfileId }, error);
      throw error;
    }
  }

  /**
   * Calculate weekly adherence for last 7 days (rolling window)
   * Returns array of 7 numbers representing adherence percentage for each day
   * Day 0 = 6 days ago, Day 6 = today
   */
  private calculateWeeklyAdherence(workoutLogs: any[]): number[] {
    const now = new Date();
    // Calculate start date (6 days ago, so we have 7 days total: today + 6 previous days)
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    AppLogger.logOperation('WEEKLY_ADHERENCE_CALC_START', {
      currentDate: now.toISOString(),
      startDate: startDate.toISOString(),
      calculationType: 'rolling_7_days',
    }, 'debug');

    const weeklyAdherence: number[] = [];
    
    // Calculate adherence for each of the last 7 days
    for (let day = 0; day < 7; day++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(startDate.getDate() + day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      // Filter workouts for this day
      const dayWorkouts = workoutLogs.filter((log: any) => {
        const workoutDate = new Date(log.workoutDate);
        return workoutDate >= dayStart && workoutDate < dayEnd;
      });

      if (dayWorkouts.length === 0) {
        weeklyAdherence.push(0);
        AppLogger.logOperation('WEEKLY_ADHERENCE_DAY', {
          day,
          dayStart: dayStart.toISOString(),
          dayEnd: dayEnd.toISOString(),
          workouts: 0,
          adherence: 0,
        }, 'debug');
      } else {
        const completed = dayWorkouts.filter((log: any) => log.isCompleted).length;
        const adherence = Math.round((completed / dayWorkouts.length) * 100 * 100) / 100;
        weeklyAdherence.push(adherence);
        AppLogger.logOperation('WEEKLY_ADHERENCE_DAY', {
          day,
          dayStart: dayStart.toISOString(),
          dayEnd: dayEnd.toISOString(),
          workouts: dayWorkouts.length,
          completed,
          adherence,
        }, 'debug');
      }
    }

    AppLogger.logOperation('WEEKLY_ADHERENCE_CALC_COMPLETE', {
      weeklyAdherence,
    }, 'debug');

    return weeklyAdherence;
  }

  /**
   * Calculate strength progression for completed workouts
   * Groups by exercise name and tracks max weight per day over the last N days
   * 
   * @param workoutLogs All workout logs for the client
   * @param daysBack Number of days to look back (default: 30)
   * @returns Map of exercise name to array of {x: dayIndex, y: maxWeight} points
   */
  private calculateStrengthProgression(
    workoutLogs: any[],
    daysBack: number = 30,
  ): Record<string, Array<{ x: number; y: number }>> {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    AppLogger.logOperation('STRENGTH_PROGRESSION_CALC_START', {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      daysBack,
      totalWorkouts: workoutLogs.length,
    }, 'debug');

    // Filter completed workouts in date range
    const recentWorkouts = workoutLogs.filter((log: any) => {
      if (!log.isCompleted) return false;
      const workoutDate = new Date(log.workoutDate);
      return workoutDate >= startDate;
    });

    AppLogger.logOperation('STRENGTH_PROGRESSION_FILTERED', {
      recentWorkouts: recentWorkouts.length,
      totalWorkouts: workoutLogs.length,
    }, 'debug');

    // Group by exercise name and extract max weight per day
    const exerciseData: Record<string, Map<number, number>> = {}; // exercise -> dayIndex -> maxWeight

    for (const workout of recentWorkouts) {
      const workoutDate = new Date(workout.workoutDate);
      const daysSinceStart = Math.floor(
        (workoutDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get completed exercises for this workout
      const completedExercises = workout.completedExercises || [];

      AppLogger.logOperation('STRENGTH_PROGRESSION_WORKOUT', {
        workoutDate: workoutDate.toISOString(),
        daysSinceStart,
        exercisesCount: completedExercises.length,
      }, 'debug');

      for (const exercise of completedExercises) {
        const exerciseName = exercise.exerciseName;
        if (!exerciseName) continue;

        if (!exerciseData[exerciseName]) {
          exerciseData[exerciseName] = new Map<number, number>();
        }

        // Find max weight for this exercise in this workout
        // weightUsed is the weight used for the exercise
        const weightUsed = exercise.weightUsed || 0;

        if (weightUsed > 0) {
          const currentMax = exerciseData[exerciseName].get(daysSinceStart) || 0;
          if (weightUsed > currentMax) {
            exerciseData[exerciseName].set(daysSinceStart, weightUsed);
            AppLogger.logOperation('STRENGTH_PROGRESSION_EXERCISE_UPDATE', {
              exerciseName,
              daysSinceStart,
              weightUsed,
              previousMax: currentMax,
            }, 'debug');
          }
        }
      }
    }

    // Convert to format expected by chart: { exerciseName: [{x: dayIndex, y: maxWeight}, ...] }
    const result: Record<string, Array<{ x: number; y: number }>> = {};

    for (const [exerciseName, dayData] of Object.entries(exerciseData)) {
      const spots = Array.from(dayData.entries())
        .map(([dayIndex, maxWeight]) => ({
          x: dayIndex,
          y: maxWeight,
        }))
        .sort((a, b) => a.x - b.x);

      if (spots.length > 0) {
        result[exerciseName] = spots;
        AppLogger.logOperation('STRENGTH_PROGRESSION_EXERCISE_COMPLETE', {
          exerciseName,
          dataPoints: spots.length,
        }, 'debug');
      }
    }

    AppLogger.logOperation('STRENGTH_PROGRESSION_CALC_COMPLETE', {
      exercisesCount: Object.keys(result).length,
      exercises: Object.keys(result),
    }, 'debug');

    return result;
  }
}

