import { PenaltyType } from '../schemas/penalty-record.schema';

export class PenaltyStatusDto {
  isPenaltyMode: boolean;
  consecutiveMissedWorkouts: number;
  currentStreak: number;
  totalWorkoutsCompleted: number;
  balance: number; // Running tab balance
  monthlyBalance: number; // Current month's balance
  recentPenalties: {
    weekStartDate: Date;
    weekEndDate: Date;
    totalMissedWorkouts: number;
    penaltyType: PenaltyType;
  }[];
}

