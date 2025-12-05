import { WorkoutsService } from './workouts.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class WorkoutsController {
    private workoutsService;
    constructor(workoutsService: WorkoutsService);
    logWorkout(user: JwtPayload, dto: LogWorkoutDto): Promise<import("./schemas/workout-log.schema").WorkoutLog>;
    updateWorkoutLog(id: string, dto: UpdateWorkoutLogDto): Promise<import("./schemas/workout-log.schema").WorkoutLog>;
    getTodayWorkout(user: JwtPayload): Promise<import("./schemas/workout-log.schema").WorkoutLog | null>;
    getWorkoutById(id: string): Promise<import("./schemas/workout-log.schema").WorkoutLog>;
    getWeekWorkouts(user: JwtPayload, date: string): Promise<import("./schemas/workout-log.schema").WorkoutLog[]>;
}
