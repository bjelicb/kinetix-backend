import { WorkoutsService } from '../workouts.service';
export declare class DailyWorkoutChecker {
    private workoutsService;
    constructor(workoutsService: WorkoutsService);
    markOverdueWorkoutsAsMissed(): Promise<void>;
}
