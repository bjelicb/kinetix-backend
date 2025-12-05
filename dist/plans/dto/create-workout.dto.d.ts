export declare class ExerciseDto {
    name: string;
    sets: number;
    reps: string | number;
    restSeconds?: number;
    notes?: string;
    videoUrl?: string;
}
export declare class WorkoutDayDto {
    dayOfWeek: number;
    isRestDay?: boolean;
    name: string;
    exercises?: ExerciseDto[];
    estimatedDuration?: number;
    notes?: string;
}
