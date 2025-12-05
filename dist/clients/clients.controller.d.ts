import { ClientsService } from './clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { UpdateClientDto } from './dto/update-client.dto';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class ClientsController {
    private clientsService;
    private workoutsService;
    constructor(clientsService: ClientsService, workoutsService: WorkoutsService);
    getProfile(user: JwtPayload): Promise<import("./schemas/client-profile.schema").ClientProfile>;
    updateProfile(user: JwtPayload, dto: UpdateClientDto): Promise<import("./schemas/client-profile.schema").ClientProfile>;
    getCurrentPlan(user: JwtPayload): Promise<any>;
    getUpcomingWorkouts(user: JwtPayload): Promise<import("../workouts/schemas/workout-log.schema").WorkoutLog[]>;
    getWorkoutHistory(user: JwtPayload): Promise<import("../workouts/schemas/workout-log.schema").WorkoutLog[]>;
    getTrainer(user: JwtPayload): Promise<{
        id: any;
    }>;
    getStats(user: JwtPayload): Promise<any>;
}
