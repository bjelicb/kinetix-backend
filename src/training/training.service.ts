import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { CheckInsService } from '../checkins/checkins.service';
import { WorkoutLog } from '../workouts/schemas/workout-log.schema';
import { CheckIn } from '../checkins/schemas/checkin.schema';

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
    private workoutsService: WorkoutsService,
    private checkInsService: CheckInsService,
    @InjectModel(WorkoutLog.name)
    private workoutLogModel: Model<any>,
    @InjectModel(CheckIn.name)
    private checkInModel: Model<any>,
  ) {}

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
          const workoutDate = new Date(logDto.workoutDate);
          
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
                });
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
          // Check if check-in already exists for this date
          const checkInDate = new Date(checkInDto.checkinDate);
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

