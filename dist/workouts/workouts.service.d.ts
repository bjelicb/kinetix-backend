import { Model } from 'mongoose';
import { WorkoutLog, WorkoutLogDocument } from './schemas/workout-log.schema';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';
import { ClientProfile } from '../clients/schemas/client-profile.schema';
import { WeeklyPlan } from '../plans/schemas/weekly-plan.schema';
import { ClientsService } from '../clients/clients.service';
export declare class WorkoutsService {
    private workoutLogModel;
    private clientsService;
    constructor(workoutLogModel: Model<WorkoutLogDocument>, clientsService: ClientsService);
    generateWeeklyLogs(client: ClientProfile, plan: WeeklyPlan, startDate: Date): Promise<WorkoutLog[]>;
    logWorkout(userId: string, dto: LogWorkoutDto): Promise<WorkoutLog>;
    updateWorkoutLog(logId: string, dto: UpdateWorkoutLogDto): Promise<WorkoutLog>;
    getTodayWorkout(userId: string): Promise<WorkoutLog | null>;
    getWorkoutById(logId: string): Promise<WorkoutLog>;
    getWeekWorkouts(userId: string, date: Date): Promise<WorkoutLog[]>;
    getWorkoutHistory(clientId: string): Promise<WorkoutLog[]>;
    markMissedWorkouts(): Promise<number>;
}
