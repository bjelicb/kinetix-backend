"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlansService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const weekly_plan_schema_1 = require("./schemas/weekly-plan.schema");
const clients_service_1 = require("../clients/clients.service");
const workouts_service_1 = require("../workouts/workouts.service");
const trainers_service_1 = require("../trainers/trainers.service");
let PlansService = class PlansService {
    planModel;
    clientsService;
    workoutsService;
    trainersService;
    constructor(planModel, clientsService, workoutsService, trainersService) {
        this.planModel = planModel;
        this.clientsService = clientsService;
        this.workoutsService = workoutsService;
        this.trainersService = trainersService;
    }
    async createPlan(userId, dto) {
        const trainerProfile = await this.trainersService.getProfile(userId);
        const trainerProfileId = trainerProfile._id;
        const plan = new this.planModel({
            trainerId: trainerProfileId,
            ...dto,
            isTemplate: dto.isTemplate !== undefined ? dto.isTemplate : true,
        });
        return plan.save();
    }
    async getPlans(userId) {
        const trainerProfile = await this.trainersService.getProfile(userId);
        const trainerProfileId = trainerProfile._id;
        return this.planModel
            .find({ trainerId: trainerProfileId })
            .select('trainerId name description difficulty workouts assignedClientIds isTemplate createdAt updatedAt')
            .populate('assignedClientIds', 'userId')
            .lean()
            .exec();
    }
    async getPlanById(planId) {
        const plan = await this.planModel
            .findById(planId)
            .populate('trainerId', 'businessName')
            .populate('assignedClientIds', 'userId')
            .exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        return plan;
    }
    async updatePlan(planId, userId, dto) {
        const plan = await this.getPlanById(planId);
        const planTrainerId = plan.trainerId?._id || plan.trainerId;
        const trainerProfile = await this.trainersService.getProfile(userId);
        const trainerProfileId = trainerProfile._id;
        if (planTrainerId.toString() !== trainerProfileId.toString()) {
            throw new common_1.ForbiddenException('You can only update your own plans');
        }
        const updatedPlan = await this.planModel
            .findByIdAndUpdate(planId, { $set: dto }, { new: true })
            .exec();
        if (!updatedPlan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        return updatedPlan;
    }
    async deletePlan(planId, userId) {
        const plan = await this.getPlanById(planId);
        const planTrainerId = plan.trainerId?._id || plan.trainerId;
        const trainerProfile = await this.trainersService.getProfile(userId);
        const trainerProfileId = trainerProfile._id;
        if (planTrainerId.toString() !== trainerProfileId.toString()) {
            throw new common_1.ForbiddenException('You can only delete your own plans');
        }
        await this.planModel.findByIdAndDelete(planId).exec();
    }
    async assignPlanToClients(planId, userId, dto) {
        const plan = await this.getPlanById(planId);
        const planTrainerId = plan.trainerId?._id || plan.trainerId;
        const trainerProfile = await this.trainersService.getProfile(userId);
        const trainerProfileId = trainerProfile._id;
        if (planTrainerId.toString() !== trainerProfileId.toString()) {
            throw new common_1.ForbiddenException('You can only assign your own plans');
        }
        const startDate = new Date(dto.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        for (const clientProfileId of dto.clientIds) {
            const client = await this.clientsService.getProfileById(clientProfileId);
            const clientUserId = client.userId?._id?.toString() || client.userId?.toString() || client.userId.toString();
            await this.clientsService.updateProfile(clientUserId, {
                currentPlanId: planId,
                planStartDate: startDate.toISOString(),
                planEndDate: endDate.toISOString(),
            });
        }
        await this.planModel.findByIdAndUpdate(planId, {
            $addToSet: { assignedClientIds: { $each: dto.clientIds.map(id => new mongoose_2.Types.ObjectId(id)) } },
        }).exec();
        const planForLogs = await this.planModel.findById(planId).exec();
        if (!planForLogs) {
            throw new common_1.NotFoundException('Plan not found');
        }
        for (const clientProfileId of dto.clientIds) {
            try {
                const client = await this.clientsService.getProfileById(clientProfileId);
                await this.workoutsService.generateWeeklyLogs(client, planForLogs, startDate);
            }
            catch (error) {
                console.error(`Error generating logs for client ${clientProfileId}:`, error);
                throw error;
            }
        }
        return {
            message: 'Plan assigned successfully',
            planId,
            clientIds: dto.clientIds,
            startDate,
            endDate,
        };
    }
    async duplicatePlan(planId, userId) {
        const originalPlan = await this.getPlanById(planId);
        const trainerProfile = await this.trainersService.getProfile(userId);
        const trainerProfileId = trainerProfile._id;
        const duplicatedPlan = new this.planModel({
            trainerId: trainerProfileId,
            name: `${originalPlan.name} (Copy)`,
            description: originalPlan.description,
            difficulty: originalPlan.difficulty,
            workouts: originalPlan.workouts,
            isTemplate: true,
            assignedClientIds: [],
        });
        return duplicatedPlan.save();
    }
};
exports.PlansService = PlansService;
exports.PlansService = PlansService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(weekly_plan_schema_1.WeeklyPlan.name)),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => clients_service_1.ClientsService))),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => workouts_service_1.WorkoutsService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        clients_service_1.ClientsService,
        workouts_service_1.WorkoutsService,
        trainers_service_1.TrainersService])
], PlansService);
//# sourceMappingURL=plans.service.js.map