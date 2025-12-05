import { Model } from 'mongoose';
import { WeeklyPlan, WeeklyPlanDocument } from './schemas/weekly-plan.schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { TrainersService } from '../trainers/trainers.service';
export declare class PlansService {
    private planModel;
    private clientsService;
    private workoutsService;
    private trainersService;
    constructor(planModel: Model<WeeklyPlanDocument>, clientsService: ClientsService, workoutsService: WorkoutsService, trainersService: TrainersService);
    createPlan(userId: string, dto: CreatePlanDto): Promise<WeeklyPlan>;
    getPlans(userId: string): Promise<WeeklyPlan[]>;
    getPlanById(planId: string): Promise<WeeklyPlan>;
    updatePlan(planId: string, userId: string, dto: UpdatePlanDto): Promise<WeeklyPlan>;
    deletePlan(planId: string, userId: string): Promise<void>;
    assignPlanToClients(planId: string, userId: string, dto: AssignPlanDto): Promise<any>;
    duplicatePlan(planId: string, userId: string): Promise<WeeklyPlan>;
}
