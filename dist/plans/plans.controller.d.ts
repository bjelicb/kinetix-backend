import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class PlansController {
    private plansService;
    constructor(plansService: PlansService);
    createPlan(user: JwtPayload, dto: CreatePlanDto): Promise<import("./schemas/weekly-plan.schema").WeeklyPlan>;
    getPlans(user: JwtPayload): Promise<import("./schemas/weekly-plan.schema").WeeklyPlan[]>;
    getPlanById(id: string): Promise<import("./schemas/weekly-plan.schema").WeeklyPlan>;
    updatePlan(user: JwtPayload, id: string, dto: UpdatePlanDto): Promise<import("./schemas/weekly-plan.schema").WeeklyPlan>;
    deletePlan(user: JwtPayload, id: string): Promise<{
        message: string;
    }>;
    assignPlan(user: JwtPayload, id: string, dto: AssignPlanDto): Promise<any>;
    duplicatePlan(user: JwtPayload, id: string): Promise<import("./schemas/weekly-plan.schema").WeeklyPlan>;
}
