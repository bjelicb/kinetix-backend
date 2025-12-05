export declare class CompletedExerciseDto {
    exerciseName: string;
    actualSets: number;
    actualReps: number[];
    weightUsed?: number;
    notes?: string;
}
export declare class LogWorkoutDto {
    workoutDate: string;
    weeklyPlanId: string;
    dayOfWeek: number;
    completedExercises?: CompletedExerciseDto[];
    isCompleted?: boolean;
    completedAt?: string;
    difficultyRating?: number;
    clientNotes?: string;
}
