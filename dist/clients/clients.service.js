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
exports.ClientsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const client_profile_schema_1 = require("./schemas/client-profile.schema");
const plans_service_1 = require("../plans/plans.service");
let ClientsService = class ClientsService {
    clientModel;
    plansService;
    constructor(clientModel, plansService) {
        this.clientModel = clientModel;
        this.plansService = plansService;
    }
    async createProfile(userId, trainerId, dto) {
        const clientProfile = new this.clientModel({
            userId: new mongoose_2.Types.ObjectId(userId),
            trainerId: new mongoose_2.Types.ObjectId(trainerId),
            ...dto,
        });
        return clientProfile.save();
    }
    async getProfile(userId) {
        const profile = await this.clientModel
            .findOne({ userId: new mongoose_2.Types.ObjectId(userId) })
            .populate('userId', 'email firstName lastName')
            .populate('trainerId', 'businessName')
            .populate('currentPlanId')
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('Client profile not found');
        }
        return profile;
    }
    async getProfileById(profileId) {
        const profile = await this.clientModel
            .findById(profileId)
            .populate('userId', 'email firstName lastName')
            .populate('trainerId', 'businessName')
            .populate('currentPlanId')
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('Client profile not found');
        }
        return profile;
    }
    async updateProfile(userId, dto) {
        const updateData = { ...dto };
        if (dto.currentPlanId) {
            updateData.currentPlanId = new mongoose_2.Types.ObjectId(dto.currentPlanId);
        }
        if (dto.planStartDate) {
            updateData.planStartDate = new Date(dto.planStartDate);
        }
        if (dto.planEndDate) {
            updateData.planEndDate = new Date(dto.planEndDate);
        }
        const profile = await this.clientModel
            .findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: updateData }, { new: true })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('Client profile not found');
        }
        return profile;
    }
    async getCurrentPlan(userId) {
        const profile = await this.getProfile(userId);
        if (!profile.currentPlanId) {
            return null;
        }
        const planId = profile.currentPlanId?._id
            ? profile.currentPlanId._id.toString()
            : profile.currentPlanId.toString();
        return this.plansService.getPlanById(planId);
    }
    async getStats(userId) {
        const profile = await this.getProfile(userId);
        return {
            totalWorkoutsCompleted: profile.totalWorkoutsCompleted,
            currentStreak: profile.currentStreak,
            isPenaltyMode: profile.isPenaltyMode,
            consecutiveMissedWorkouts: profile.consecutiveMissedWorkouts,
        };
    }
};
exports.ClientsService = ClientsService;
exports.ClientsService = ClientsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(client_profile_schema_1.ClientProfile.name)),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => plans_service_1.PlansService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        plans_service_1.PlansService])
], ClientsService);
//# sourceMappingURL=clients.service.js.map