import { PenaltyType } from '../schemas/penalty-record.schema';
export declare class PenaltyStatusDto {
    isPenaltyMode: boolean;
    consecutiveMissedWorkouts: number;
    currentStreak: number;
    totalWorkoutsCompleted: number;
    recentPenalties: {
        weekStartDate: Date;
        weekEndDate: Date;
        totalMissedWorkouts: number;
        penaltyType: PenaltyType;
    }[];
}
