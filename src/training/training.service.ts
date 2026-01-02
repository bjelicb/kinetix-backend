import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncChangesResponseDto } from './dto/sync-changes-response.dto';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { CheckInsService } from '../checkins/checkins.service';
import { WorkoutLog } from '../workouts/schemas/workout-log.schema';
import { CheckIn } from '../checkins/schemas/checkin.schema';
import { WeeklyPlan } from '../plans/schemas/weekly-plan.schema';
import { TrainerProfile } from '../trainers/schemas/trainer-profile.schema';
import { UserRole } from '../common/enums/user-role.enum';
import { DateUtils } from '../common/utils/date.utils';

export interface SyncError {
  type: 'LOG' | 'CHECKIN';
  index: number;
  reason: string;
}

export interface SyncResult {
  processedLogs: number;
  processedCheckIns: number;
  errors: SyncError[];
}

@Injectable()
export class TrainingService {
  constructor(
    private clientsService: ClientsService,
    private trainersService: TrainersService,
    private workoutsService: WorkoutsService,
    private checkInsService: CheckInsService,
    @InjectModel(WorkoutLog.name)
    private workoutLogModel: Model<any>,
    @InjectModel(CheckIn.name)
    private checkInModel: Model<any>,
    @InjectModel(WeeklyPlan.name)
    private weeklyPlanModel: Model<any>,
  ) {}

  /**
   * Get all changes (workouts, plans, check-ins) since a given timestamp
   * Filters data based on user role:
   * - CLIENT: sees only their own data
   * - TRAINER: sees their own data + their clients' data
   * - ADMIN: sees all data
   */
  async getSyncChanges(
    userId: string,
    userRole: string,
    since: Date,
  ): Promise<SyncChangesResponseDto> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[TrainingService] getSyncChanges() START');
    console.log('[TrainingService] → User ID:', userId);
    console.log('[TrainingService] → User role:', userRole);
    console.log('[TrainingService] → Since:', since);
    
    const sinceNormalized = DateUtils.normalizeToStartOfDay(since);
    console.log('[TrainingService] → Since normalized:', sinceNormalized);

    let workouts: any[] = [];
    let plans: any[] = [];
    let checkIns: any[] = [];

    if (userRole === UserRole.CLIENT) {
      console.log('[TrainingService] → Processing CLIENT role...');
      
      // CLIENT sees only their own data
      console.log('[TrainingService] → Fetching workouts...');
      workouts = await this.workoutLogModel
        .find({
          clientId: new Types.ObjectId(userId),
          updatedAt: { $gte: sinceNormalized },
        })
        .limit(100)
        .populate('weeklyPlanId')
        .lean()
        .exec();
      console.log('[TrainingService] → Workouts found:', workouts.length);

      console.log('[TrainingService] → Fetching check-ins...');
      checkIns = await this.checkInModel
        .find({
          clientId: new Types.ObjectId(userId),
          updatedAt: { $gte: sinceNormalized },
        })
        .limit(100)
        .lean()
        .exec();
      console.log('[TrainingService] → CheckIns found:', checkIns.length);

      // Get client's active plan from planHistory
      console.log('[TrainingService] → Fetching client profile...');
      const clientProfile = await this.clientsService.getProfile(userId);
      
      if (clientProfile) {
        console.log('[TrainingService] → Client profile found');
        console.log('[TrainingService] → planHistory length:', clientProfile.planHistory?.length || 0);
        console.log('[TrainingService] → currentPlanId:', clientProfile.currentPlanId ? 'exists' : 'null');
        
        // Try to get active plan from planHistory first
        let activePlanId: Types.ObjectId | null = null;
        
        if (clientProfile.planHistory && clientProfile.planHistory.length > 0) {
          console.log('[TrainingService] → Checking planHistory for active plan...');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const activePlanEntry = clientProfile.planHistory.find((entry) => {
            const start = new Date(entry.planStartDate);
            const end = new Date(entry.planEndDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return start <= today && end >= today;
          });
          
          if (activePlanEntry) {
            activePlanId = activePlanEntry.planId as Types.ObjectId;
            console.log('[TrainingService] ✓ Active plan found in planHistory');
          } else {
            console.log('[TrainingService] ✗ No active plan in planHistory');
          }
        }
        
        // Fallback to currentPlanId for backward compatibility
        if (!activePlanId && clientProfile.currentPlanId) {
          activePlanId = clientProfile.currentPlanId as Types.ObjectId;
          console.log('[TrainingService] → Using currentPlanId as fallback');
        }
        
        if (activePlanId) {
          console.log('[TrainingService] → Fetching plan from database, planId:', activePlanId);
          const plan = await this.weeklyPlanModel
            .findOne({
              _id: activePlanId,
              updatedAt: { $gte: sinceNormalized },
            })
            .lean()
            .exec();
          
          if (plan) {
            console.log('[TrainingService] ✓ Plan found:', plan.name);
            console.log('[TrainingService] → Plan updatedAt:', plan.updatedAt);
            console.log('[TrainingService] → Since normalized:', sinceNormalized);
            plans.push(plan);
          } else {
            console.log('[TrainingService] ✗ Plan not found or not updated since:', sinceNormalized);
            // Also check if plan exists but was updated before 'since' date
            const planBeforeSince = await this.weeklyPlanModel
              .findOne({ _id: activePlanId })
              .lean()
              .exec();
            if (planBeforeSince) {
              console.log('[TrainingService] → Plan exists but updatedAt:', planBeforeSince.updatedAt, '(before since date)');
            }
          }
        } else {
          console.log('[TrainingService] ✗ No active plan ID found');
        }
      } else {
        console.log('[TrainingService] ✗ Client profile not found');
      }
      
      console.log('[TrainingService] → Plans found:', plans.length);
    } else if (userRole === UserRole.TRAINER) {
      // TRAINER sees their own plans + their clients' data
      const trainerProfile: TrainerProfile = await this.trainersService.getProfile(userId);
      const clientIds = trainerProfile?.clientIds || [];

      workouts = await this.workoutLogModel
        .find({
          clientId: { $in: clientIds.map((id: any) => new Types.ObjectId(id)) },
          updatedAt: { $gte: sinceNormalized },
        })
        .limit(100)
        .populate('weeklyPlanId')
        .lean()
        .exec();

      plans = await this.weeklyPlanModel
        .find({
          trainerId: new Types.ObjectId(userId),
          updatedAt: { $gte: sinceNormalized },
        })
        .limit(100)
        .lean()
        .exec();
      console.log('[TrainingService] → Plans found:', plans.length);

      checkIns = await this.checkInModel
        .find({
          clientId: { $in: clientIds.map((id: any) => new Types.ObjectId(id)) },
          updatedAt: { $gte: sinceNormalized },
        })
        .limit(100)
        .lean()
        .exec();
      console.log('[TrainingService] → CheckIns found:', checkIns.length);
    } else if (userRole === UserRole.ADMIN) {
      console.log('[TrainingService] → Processing ADMIN role...');
      
      // ADMIN sees all data
      console.log('[TrainingService] → Fetching all workouts...');
      workouts = await this.workoutLogModel
        .find({ updatedAt: { $gte: sinceNormalized } })
        .limit(100)
        .populate('weeklyPlanId')
        .lean()
        .exec();
      console.log('[TrainingService] → Workouts found:', workouts.length);

      console.log('[TrainingService] → Fetching all plans...');
      plans = await this.weeklyPlanModel
        .find({ updatedAt: { $gte: sinceNormalized } })
        .limit(100)
        .lean()
        .exec();
      console.log('[TrainingService] → Plans found:', plans.length);

      console.log('[TrainingService] → Fetching all check-ins...');
      checkIns = await this.checkInModel
        .find({ updatedAt: { $gte: sinceNormalized } })
        .limit(100)
        .lean()
        .exec();
      console.log('[TrainingService] → CheckIns found:', checkIns.length);
    }

    const totalRecords = workouts.length + plans.length + checkIns.length;
    console.log('[TrainingService] → Preparing response...');
    console.log('[TrainingService] → Total records:', totalRecords);
    console.log('[TrainingService] → Workouts:', workouts.length);
    console.log('[TrainingService] → Plans:', plans.length);
    console.log('[TrainingService] → CheckIns:', checkIns.length);
    
    if (plans.length > 0) {
      console.log('[TrainingService] → Plan details:');
      plans.forEach((plan, index) => {
        console.log(`[TrainingService]   [${index + 1}] Plan: ${plan.name} (ID: ${plan._id})`);
        console.log(`[TrainingService]      UpdatedAt: ${plan.updatedAt}`);
      });
    }

    const result = {
      workouts,
      plans,
      checkIns,
      lastSync: new Date(),
      totalRecords,
    };
    
    console.log('[TrainingService] ✓ Sync changes response prepared');
    console.log('═══════════════════════════════════════════════════════════');
    
    return result;
  }

  async syncBatch(clientId: string, syncBatchDto: SyncBatchDto): Promise<SyncResult> {
    const clientProfile = await this.clientsService.getProfile(clientId);
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found.');
    }

    const result: SyncResult = {
      processedLogs: 0,
      processedCheckIns: 0,
      errors: [],
    };

    // Process workout logs - collect updates for bulk operation
    if (syncBatchDto.newLogs && syncBatchDto.newLogs.length > 0) {
      const bulkOps: any[] = [];
      
      for (let i = 0; i < syncBatchDto.newLogs.length; i++) {
        const logDto = syncBatchDto.newLogs[i];
        try {
          // Normalize workout date to start of day for consistent comparison
          const workoutDate = DateUtils.normalizeToStartOfDay(new Date(logDto.workoutDate));
          
          // Find workout log for this date
          const weekWorkouts = await this.workoutsService.getWeekWorkouts(
            clientId,
            workoutDate,
          );
          const log = weekWorkouts.find(
            (w: any) =>
              new Date(w.workoutDate).toISOString().split('T')[0] ===
              workoutDate.toISOString().split('T')[0],
          );

          if (!log) {
            // Workout log should be pre-created when plan is assigned
            result.errors.push({
              type: 'LOG',
              index: i,
              reason: `Workout log not found for date ${logDto.workoutDate}. Please ensure plan is assigned.`,
            });
            continue;
          }

          // Prepare update operation
          const updateData: any = {
            completedExercises: logDto.completedExercises?.map((ex: any) => ({
              exerciseName: ex.exerciseName,
              actualSets: Array.isArray(ex.actualSets) ? ex.actualSets.length : (ex.actualSets || 0),
              actualReps: ex.actualReps || [],
              weightUsed: Array.isArray(ex.weightUsed) ? ex.weightUsed[0] : ex.weightUsed,
              notes: ex.notes,
            })),
            isCompleted: logDto.isCompleted ?? true,
          };

          if (logDto.completedAt) {
            updateData.completedAt = new Date(logDto.completedAt);
          }
          if (logDto.difficultyRating !== undefined) {
            updateData.difficultyRating = logDto.difficultyRating;
          }
          if (logDto.clientNotes !== undefined) {
            updateData.clientNotes = logDto.clientNotes;
          }

          bulkOps.push({
            updateOne: {
              filter: { _id: new Types.ObjectId((log as any)._id) },
              update: { $set: updateData },
            },
          });
        } catch (error) {
          result.errors.push({
            type: 'LOG',
            index: i,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Execute bulk update if there are operations
      if (bulkOps.length > 0) {
        try {
          await this.workoutLogModel.bulkWrite(bulkOps);
          result.processedLogs = bulkOps.length;
        } catch (error) {
          // If bulk write fails, fall back to individual updates
          for (let i = 0; i < syncBatchDto.newLogs.length; i++) {
            const logDto = syncBatchDto.newLogs[i];
            try {
              const workoutDate = new Date(logDto.workoutDate);
              const weekWorkouts = await this.workoutsService.getWeekWorkouts(
                clientId,
                workoutDate,
              );
              const log = weekWorkouts.find(
                (w: any) =>
                  new Date(w.workoutDate).toISOString().split('T')[0] ===
                  workoutDate.toISOString().split('T')[0],
              );

              if (log) {
                await this.workoutsService.updateWorkoutLog((log as any)._id.toString(), {
                  completedExercises: logDto.completedExercises?.map((ex: any) => ({
                    exerciseName: ex.exerciseName,
                    actualSets: Array.isArray(ex.actualSets) ? ex.actualSets.length : (ex.actualSets || 0),
                    actualReps: ex.actualReps || [],
                    weightUsed: Array.isArray(ex.weightUsed) ? ex.weightUsed[0] : ex.weightUsed,
                    notes: ex.notes,
                  })),
                  isCompleted: logDto.isCompleted ?? true,
                  completedAt: logDto.completedAt,
                  difficultyRating: logDto.difficultyRating,
                  clientNotes: logDto.clientNotes,
                }, clientId);
                result.processedLogs++;
              }
            } catch (error) {
              result.errors.push({
                type: 'LOG',
                index: i,
                reason: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }
      }
    }

    // Process check-ins
    if (syncBatchDto.newCheckIns && syncBatchDto.newCheckIns.length > 0) {
      for (let i = 0; i < syncBatchDto.newCheckIns.length; i++) {
        const checkInDto = syncBatchDto.newCheckIns[i];
        try {
          // Normalize check-in date to start of day for consistent comparison
          const checkInDate = DateUtils.normalizeToStartOfDay(new Date(checkInDto.checkinDate));
          const existingCheckIns = await this.checkInsService.getCheckInsByDateRange(
            clientId,
            checkInDate,
            checkInDate,
          );

          const existingCheckIn = existingCheckIns.find(
            (c) =>
              c.checkinDate.toISOString().split('T')[0] ===
              checkInDate.toISOString().split('T')[0],
          );

          if (existingCheckIn) {
            // Skip duplicate check-in
            result.errors.push({
              type: 'CHECKIN',
              index: i,
              reason: `Check-in already exists for date ${checkInDto.checkinDate}`,
            });
            continue;
          }

          // Create new check-in
          await this.checkInsService.createCheckIn(clientId, {
            workoutLogId: checkInDto.workoutLogId,
            checkinDate: checkInDto.checkinDate,
            photoUrl: checkInDto.photoUrl,
            thumbnailUrl: checkInDto.thumbnailUrl,
            gpsCoordinates: checkInDto.gpsCoordinates,
            clientNotes: checkInDto.clientNotes,
          });

          result.processedCheckIns++;
        } catch (error) {
          result.errors.push({
            type: 'CHECKIN',
            index: i,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return result;
  }
}

