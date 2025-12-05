import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WorkoutsService } from '../workouts.service';

@Injectable()
export class DailyWorkoutChecker {
  constructor(private workoutsService: WorkoutsService) {}

  @Cron('0 2 * * *') // Every day at 2:00 AM
  async markOverdueWorkoutsAsMissed() {
    try {
      const count = await this.workoutsService.markMissedWorkouts();
      console.log(`[DailyWorkoutChecker] Marked ${count} workouts as missed`);
    } catch (error) {
      console.error('[DailyWorkoutChecker] Error marking missed workouts:', error);
    }
  }
}

