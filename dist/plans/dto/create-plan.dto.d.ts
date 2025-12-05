import { WorkoutDifficulty } from '../../common/enums/workout-difficulty.enum';
import { WorkoutDayDto } from './create-workout.dto';
export declare class CreatePlanDto {
    name: string;
    description?: string;
    difficulty?: WorkoutDifficulty;
    workouts?: WorkoutDayDto[];
    isTemplate?: boolean;
}
