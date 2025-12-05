declare class CompletedExerciseDto {
    exerciseName: string;
    targetSets?: number;
    targetReps?: string;
    actualSets?: number[];
    actualReps?: number[];
    weightUsed?: number[];
    restSeconds?: number;
    notes?: string;
}
declare class WorkoutLogDto {
    workoutDate: string;
    weeklyPlanId: string;
    dayOfWeek: number;
    completedExercises?: CompletedExerciseDto[];
    isCompleted?: boolean;
    completedAt?: string;
    difficultyRating?: number;
    clientNotes?: string;
}
declare class GpsCoordinatesDto {
    latitude: number;
    longitude: number;
    accuracy?: number;
}
declare class CheckInDto {
    checkinDate: string;
    photoUrl: string;
    thumbnailUrl?: string;
    gpsCoordinates: GpsCoordinatesDto;
    workoutLogId?: string;
    clientNotes?: string;
}
export declare class SyncBatchDto {
    syncedAt: string;
    newLogs?: WorkoutLogDto[];
    newCheckIns?: CheckInDto[];
}
export {};
