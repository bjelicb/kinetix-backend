import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PenaltyRecord, PenaltyRecordDocument } from '../schemas/penalty-record.schema';
import { ClientProfile, ClientProfileDocument } from '../../clients/schemas/client-profile.schema';
import { WorkoutLog, WorkoutLogDocument } from '../../workouts/schemas/workout-log.schema';
import { PenaltyType } from '../schemas/penalty-record.schema';
import moment from 'moment';

@Injectable()
export class WeeklyPenaltyJob {
  constructor(
    @InjectModel(PenaltyRecord.name) private penaltyRecordModel: Model<PenaltyRecordDocument>,
    @InjectModel(ClientProfile.name) private clientProfileModel: Model<ClientProfileDocument>,
    @InjectModel(WorkoutLog.name) private workoutLogModel: Model<WorkoutLogDocument>,
  ) {}

  @Cron('0 0 * * 1') // Every Monday at midnight
  async calculateWeeklyPenalties() {
    const lastWeekStart = moment().subtract(1, 'week').startOf('week').toDate();
    const lastWeekEnd = moment().subtract(1, 'week').endOf('week').toDate();

    // Get all active clients
    const clients = await this.clientProfileModel.find({}).exec();

    for (const client of clients) {
      try {
        // Count missed workouts in past week
        const missedCount = await this.workoutLogModel.countDocuments({
          clientId: client._id,
          workoutDate: {
            $gte: lastWeekStart,
            $lte: lastWeekEnd,
          },
          isMissed: true,
        }).exec();

        // Count total scheduled workouts
        const totalScheduled = await this.workoutLogModel.countDocuments({
          clientId: client._id,
          workoutDate: {
            $gte: lastWeekStart,
            $lte: lastWeekEnd,
          },
        }).exec();

        const completionRate = totalScheduled > 0 ? ((totalScheduled - missedCount) / totalScheduled) * 100 : 0;

        // Rule: > 2 missed workouts = Penalty Mode
        let penaltyType: PenaltyType = PenaltyType.NONE;
        let isPenaltyApplied = false;

        if (missedCount > 2) {
          penaltyType = PenaltyType.PENALTY_MODE;
          isPenaltyApplied = true;
          client.isPenaltyMode = true;
          client.consecutiveMissedWorkouts += missedCount;
          client.currentStreak = 0; // Reset streak
        } else if (missedCount > 0) {
          penaltyType = PenaltyType.WARNING;
          client.isPenaltyMode = false;
          client.consecutiveMissedWorkouts = 0;
        } else {
          client.isPenaltyMode = false;
          client.consecutiveMissedWorkouts = 0;
        }

        // Create or update penalty record
        await this.penaltyRecordModel.findOneAndUpdate(
          {
            clientId: client._id,
            weekStartDate: lastWeekStart,
          },
          {
            clientId: client._id,
            trainerId: client.trainerId,
            weekStartDate: lastWeekStart,
            weekEndDate: lastWeekEnd,
            totalMissedWorkouts: missedCount,
            totalScheduledWorkouts: totalScheduled,
            completionRate,
            isPenaltyApplied,
            penaltyType,
          },
          { upsert: true, new: true },
        ).exec();

        await client.save();
      } catch (error) {
        console.error(`Error processing penalty for client ${client._id}:`, error);
      }
    }
  }
}

