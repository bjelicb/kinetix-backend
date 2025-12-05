import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkoutLog, WorkoutLogDocument } from '../schemas/workout-log.schema';
import { CheckIn, CheckInDocument } from '../../checkins/schemas/checkin.schema';
import moment from 'moment';

@Injectable()
export class CleanupOldLogs {
  constructor(
    @InjectModel(WorkoutLog.name)
    private workoutLogModel: Model<WorkoutLogDocument>,
    @InjectModel(CheckIn.name)
    private checkInModel: Model<CheckInDocument>,
  ) {}

  @Cron('0 3 * * 0') // Every Sunday at 3:00 AM
  async cleanupOldLogs() {
    try {
      const cutoffDate = moment().subtract(90, 'days').toDate();

      // Delete old workout logs
      const workoutResult = await this.workoutLogModel.deleteMany({
        createdAt: { $lt: cutoffDate },
      }).exec();

      // Delete old check-ins
      const checkInResult = await this.checkInModel.deleteMany({
        createdAt: { $lt: cutoffDate },
      }).exec();

      console.log(
        `[CleanupOldLogs] Deleted ${workoutResult.deletedCount} workout logs and ${checkInResult.deletedCount} check-ins older than 90 days`,
      );
    } catch (error) {
      console.error('[CleanupOldLogs] Error cleaning up old logs:', error);
    }
  }
}

