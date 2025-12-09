import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkoutLog, WorkoutLogDocument } from './schemas/workout-log.schema';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';
import { ClientProfile } from '../clients/schemas/client-profile.schema';
import { WeeklyPlan } from '../plans/schemas/weekly-plan.schema';
import { ClientsService } from '../clients/clients.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectModel(WorkoutLog.name)
    private workoutLogModel: Model<WorkoutLogDocument>,
    @Inject(forwardRef(() => ClientsService))
    private clientsService: ClientsService,
    @Inject(forwardRef(() => GamificationService))
    private gamificationService: GamificationService,
  ) {}

  async generateWeeklyLogs(
    client: ClientProfile,
    plan: WeeklyPlan,
    startDate: Date,
  ): Promise<WorkoutLog[]> {
    try {
      const logs: WorkoutLog[] = [];
      const weekStartDate = new Date(startDate);
      weekStartDate.setHours(0, 0, 0, 0);

      // Validate plan has workouts
      const planWorkouts = (plan as any).workouts || plan.workouts;
      if (!planWorkouts || !Array.isArray(planWorkouts)) {
        throw new Error(`Plan does not have valid workouts array. Plan ID: ${(plan as any)._id}`);
      }

      // Get client profile ID (not userId)
      const clientProfileId = (client as any)._id || (client as any).id;
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

      // Get plan ID
      const planId = (plan as any)._id || (plan as any).id;
      if (!planId) {
        throw new Error('Plan ID is missing');
      }

      // Generate 7 WorkoutLog documents (one per day)
      for (let day = 0; day < 7; day++) {
        const workoutDate = new Date(weekStartDate);
        workoutDate.setDate(workoutDate.getDate() + day);
        workoutDate.setHours(0, 0, 0, 0);
        
        const workoutDateEnd = new Date(workoutDate);
        workoutDateEnd.setHours(23, 59, 59, 999);

        // Check if log already exists for this specific date using MongoDB query
        // Note: MongoDB index is on clientId_1_workoutDate_1, so we check without weeklyPlanId
        const existingLog = await this.workoutLogModel.findOne({
          clientId: new Types.ObjectId(clientProfileId),
          workoutDate: {
            $gte: workoutDate,
            $lt: workoutDateEnd,
          },
        }).exec();

        if (existingLog) {
          // Skip if log already exists
          continue;
        }

        const dayOfWeek = workoutDate.getDay() === 0 ? 7 : workoutDate.getDay(); // Convert Sunday (0) to 7

        // Find workout for this day from plan
        const planWorkout = planWorkouts.find((w: any) => w.dayOfWeek === dayOfWeek) || null;

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
          workoutDate,
          weekNumber: 1, // First week
          dayOfWeek,
          isCompleted: false,
          isMissed: planWorkout?.isRestDay === true ? false : false, // Not missed initially
          completedExercises,
        });

        logs.push(log);
      }

      // Save all logs (only if there are new ones to create)
      if (logs.length > 0) {
        try {
          return await this.workoutLogModel.insertMany(logs, { ordered: false });
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

  async logWorkout(userId: string, dto: LogWorkoutDto): Promise<WorkoutLog> {
    // Get client profile to get clientProfileId
    const client = await this.clientsService.getProfile(userId);
    const clientProfileId = (client as any)._id;
    
    const workoutDate = new Date(dto.workoutDate);

    // Check if log already exists
    const existingLog = await this.workoutLogModel.findOne({
      clientId: new Types.ObjectId(clientProfileId),
      workoutDate,
    }).exec();

    if (existingLog) {
      // Update existing log
      existingLog.completedExercises = dto.completedExercises || [];
      existingLog.isCompleted = dto.isCompleted ?? true;
      existingLog.completedAt = dto.completedAt
        ? new Date(dto.completedAt)
        : new Date();
      existingLog.difficultyRating = dto.difficultyRating;
      existingLog.clientNotes = dto.clientNotes;

      return existingLog.save();
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

    const log = new this.workoutLogModel({
      clientId: new Types.ObjectId(clientProfileId),
      trainerId: new Types.ObjectId(trainerIdString),
      weeklyPlanId: new Types.ObjectId(dto.weeklyPlanId),
      workoutDate,
      dayOfWeek: dto.dayOfWeek,
      completedExercises: dto.completedExercises || [],
      isCompleted: dto.isCompleted ?? true,
      completedAt: dto.completedAt ? new Date(dto.completedAt) : new Date(),
      difficultyRating: dto.difficultyRating,
      clientNotes: dto.clientNotes,
    });

    return log.save();
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
  ): Promise<WorkoutLog[]> {
    // Get client profile to get clientProfileId
    const client = await this.clientsService.getProfile(userId);
    const clientProfileId = (client as any)._id;
    
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return this.workoutLogModel
      .find({
        clientId: new Types.ObjectId(clientProfileId),
        workoutDate: {
          $gte: weekStart,
          $lt: weekEnd,
        },
      })
      .select('clientId trainerId weeklyPlanId workoutDate weekNumber dayOfWeek completedExercises isCompleted isMissed completedAt difficultyRating clientNotes')
      .populate('weeklyPlanId', 'name')
      .sort({ workoutDate: 1 })
      .lean()
      .exec();
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
}

