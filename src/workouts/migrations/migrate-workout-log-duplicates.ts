import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkoutLog, WorkoutLogDocument } from '../schemas/workout-log.schema';
import { DateUtils } from '../../common/utils/date.utils';
import { AppLogger } from '../../common/utils/logger.utils';

@Injectable()
export class MigrateWorkoutLogDuplicatesService {
  constructor(
    @InjectModel(WorkoutLog.name)
    private workoutLogModel: Model<WorkoutLogDocument>,
  ) {}

  /**
   * Migration script to merge existing duplicate workout logs
   * Finds duplicates with same clientId and same day (different time)
   * Merges them by keeping the most recent one and normalizing workoutDate
   * 
   * IDEMPOTENT: Safe to run multiple times without issues
   * Uses batch processing for large databases to avoid memory issues
   */
  async migrateDuplicates(): Promise<{ merged: number; normalized: number; errors: number }> {
    AppLogger.logStart('MIGRATE_WORKOUT_LOG_DUPLICATES', {});

    let errorCount = 0;
    try {
      // CRITICAL: First merge duplicates, THEN normalize dates
      // If we normalize first, duplicates will get same date and cause unique index violation
      
      const totalLogs = await this.workoutLogModel.countDocuments({}).exec();
      AppLogger.logOperation('MIGRATE_START', {
        totalLogs,
      }, 'info');

      const BATCH_SIZE = 1000; // Process in batches to avoid memory issues
      let normalizedCount = 0;
      let processedCount = 0;

      // Step 1: Find and merge duplicates FIRST (before normalization)
      // Group by clientId and normalized workoutDate (but don't save yet)
      const groupedLogs = new Map<string, WorkoutLogDocument[]>();

      for (let skip = 0; skip < totalLogs; skip += BATCH_SIZE) {
        const logs = await this.workoutLogModel.find({}).skip(skip).limit(BATCH_SIZE).exec();
        
        for (const log of logs) {
          try {
            // Calculate normalized date for grouping (but don't save yet)
            const normalized = DateUtils.normalizeToStartOfDay(log.workoutDate);
            const key = `${log.clientId.toString()}_${normalized.toISOString()}`;
            
            if (!groupedLogs.has(key)) {
              groupedLogs.set(key, []);
            }
            groupedLogs.get(key)!.push(log);
            processedCount++;
          } catch (error) {
            errorCount++;
            AppLogger.logError('MIGRATE_GROUP_ERROR', {
              logId: log._id.toString(),
              error: error.message,
            }, error);
            // Continue with next log
          }
        }
      }

      // Find groups with duplicates (>1 log)
      let mergedCount = 0;
      const duplicatesToDelete: Types.ObjectId[] = [];

      for (const [key, logs] of groupedLogs.entries()) {
        if (logs.length > 1) {
          AppLogger.logWarning('MIGRATE_FOUND_DUPLICATES', {
            key,
            count: logs.length,
          });

          // Sort by createdAt (most recent first)
          // createdAt is added by Mongoose timestamps: true, but TypeScript doesn't know about it
          logs.sort((a, b) => {
            const aTime = (a as any).createdAt?.getTime() || 0;
            const bTime = (b as any).createdAt?.getTime() || 0;
            return bTime - aTime;
          });

          // Keep the first (most recent) log
          const keepLog = logs[0];
          const deleteLogs = logs.slice(1);

          // Merge completedExercises from deleted logs (if keep log is not completed)
          if (!keepLog.isCompleted) {
            for (const deleteLog of deleteLogs) {
              if (deleteLog.isCompleted && deleteLog.completedExercises?.length > 0) {
                keepLog.completedExercises = deleteLog.completedExercises;
                keepLog.isCompleted = deleteLog.isCompleted;
                keepLog.completedAt = deleteLog.completedAt;
                break; // Use first completed log's data
              }
            }
          }

          // Don't normalize yet - we'll normalize all logs after merging duplicates
          // This prevents unique index violation during merge

          // Mark duplicates for deletion
          for (const deleteLog of deleteLogs) {
            duplicatesToDelete.push(deleteLog._id);
          }

          mergedCount += deleteLogs.length;
        }
      }

      // Delete duplicates
      if (duplicatesToDelete.length > 0) {
        await this.workoutLogModel.deleteMany({
          _id: { $in: duplicatesToDelete },
        }).exec();

        AppLogger.logOperation('MIGRATE_DELETE_DUPLICATES', {
          deletedCount: duplicatesToDelete.length,
        }, 'info');
      }

      AppLogger.logOperation('MIGRATE_MERGE_COMPLETE', {
        merged: mergedCount,
      }, 'info');

      // Step 2: NOW normalize all remaining workoutDate fields (after duplicates are merged)
      const remainingLogs = await this.workoutLogModel.countDocuments({}).exec();
      
      for (let skip = 0; skip < remainingLogs; skip += BATCH_SIZE) {
        const logs = await this.workoutLogModel.find({}).skip(skip).limit(BATCH_SIZE).exec();
        
        for (const log of logs) {
          try {
            const normalized = DateUtils.normalizeToStartOfDay(log.workoutDate);
            if (log.workoutDate.getTime() !== normalized.getTime()) {
              log.workoutDate = normalized;
              await log.save();
              normalizedCount++;
            }
            
            // Progress logging every 100 logs
            if ((skip + logs.indexOf(log) + 1) % 100 === 0) {
              AppLogger.logOperation('MIGRATE_NORMALIZE_PROGRESS', {
                processed: skip + logs.indexOf(log) + 1,
                total: remainingLogs,
                normalized: normalizedCount,
                progress: `${Math.round(((skip + logs.indexOf(log) + 1) / remainingLogs) * 100)}%`,
              }, 'debug');
            }
          } catch (error) {
            errorCount++;
            AppLogger.logError('MIGRATE_NORMALIZE_ERROR', {
              logId: log._id.toString(),
              error: error.message,
            }, error);
            // Continue with next log instead of failing completely
          }
        }
      }

      AppLogger.logOperation('MIGRATE_NORMALIZE_COMPLETE', {
        normalizedCount,
      }, 'info');

      AppLogger.logComplete('MIGRATE_WORKOUT_LOG_DUPLICATES', {
        merged: mergedCount,
        normalized: normalizedCount,
        errors: errorCount,
        totalProcessed: processedCount,
      });

      // Final verification: Check if duplicates still exist
      const remainingDuplicates = await this.workoutLogModel.aggregate([
        {
          $group: {
            _id: {
              clientId: '$clientId',
              workoutDate: { $dateToString: { format: '%Y-%m-%d', date: '$workoutDate' } },
            },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ]).exec();

      if (remainingDuplicates.length > 0) {
        AppLogger.logOperation('MIGRATE_VERIFICATION_FAILED', {
          remainingDuplicates: remainingDuplicates.length,
        }, 'warn');
      } else {
        AppLogger.logOperation('MIGRATE_VERIFICATION_SUCCESS', {
          message: 'No duplicates found after migration',
        }, 'info');
      }

      return { merged: mergedCount, normalized: normalizedCount, errors: errorCount };
    } catch (error) {
      AppLogger.logError('MIGRATE_WORKOUT_LOG_DUPLICATES', {
        errors: errorCount,
      }, error);
      throw error;
    }
  }
}

