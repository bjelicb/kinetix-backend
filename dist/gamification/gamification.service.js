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
exports.GamificationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const penalty_record_schema_1 = require("./schemas/penalty-record.schema");
const client_profile_schema_1 = require("../clients/schemas/client-profile.schema");
const clients_service_1 = require("../clients/clients.service");
const trainers_service_1 = require("../trainers/trainers.service");
let GamificationService = class GamificationService {
    penaltyRecordModel;
    clientProfileModel;
    clientsService;
    trainersService;
    constructor(penaltyRecordModel, clientProfileModel, clientsService, trainersService) {
        this.penaltyRecordModel = penaltyRecordModel;
        this.clientProfileModel = clientProfileModel;
        this.clientsService = clientsService;
        this.trainersService = trainersService;
    }
    async getPenaltyStatus(clientId) {
        const clientProfile = await this.clientsService.getProfile(clientId);
        if (!clientProfile) {
            throw new common_1.NotFoundException('Client profile not found.');
        }
        const recentPenalties = await this.penaltyRecordModel
            .find({ clientId: clientProfile._id || clientProfile.userId })
            .sort({ weekStartDate: -1 })
            .limit(4)
            .exec();
        return {
            isPenaltyMode: clientProfile.isPenaltyMode,
            consecutiveMissedWorkouts: clientProfile.consecutiveMissedWorkouts,
            currentStreak: clientProfile.currentStreak,
            totalWorkoutsCompleted: clientProfile.totalWorkoutsCompleted,
            recentPenalties: recentPenalties.map((p) => ({
                weekStartDate: p.weekStartDate,
                weekEndDate: p.weekEndDate,
                totalMissedWorkouts: p.totalMissedWorkouts,
                penaltyType: p.penaltyType,
            })),
        };
    }
    async getPenaltyHistory(clientId) {
        const clientProfile = await this.clientsService.getProfile(clientId);
        if (!clientProfile) {
            throw new common_1.NotFoundException('Client profile not found.');
        }
        return this.penaltyRecordModel
            .find({ clientId: clientProfile._id || clientProfile.userId })
            .sort({ weekStartDate: -1 })
            .exec();
    }
    async resetPenalty(clientId, trainerUserId) {
        const clientProfile = await this.clientProfileModel.findById(clientId).exec();
        if (!clientProfile) {
            throw new common_1.NotFoundException('Client profile not found.');
        }
        const trainerProfile = await this.trainersService.getProfile(trainerUserId);
        const trainerProfileId = trainerProfile._id.toString();
        if (clientProfile.trainerId.toString() !== trainerProfileId) {
            throw new common_1.NotFoundException('Client not found or not authorized.');
        }
        clientProfile.isPenaltyMode = false;
        clientProfile.consecutiveMissedWorkouts = 0;
        await clientProfile.save();
    }
    async getLeaderboard(trainerUserId) {
        const trainerProfile = await this.trainersService.getProfile(trainerUserId);
        const trainerProfileId = trainerProfile._id;
        const clients = await this.clientProfileModel
            .find({ trainerId: trainerProfileId })
            .exec();
        const rankings = clients.map((client) => ({
            clientId: client._id,
            totalWorkoutsCompleted: client.totalWorkoutsCompleted,
            currentStreak: client.currentStreak,
            isPenaltyMode: client.isPenaltyMode,
            consecutiveMissedWorkouts: client.consecutiveMissedWorkouts,
        }));
        rankings.sort((a, b) => {
            if (b.currentStreak !== a.currentStreak) {
                return b.currentStreak - a.currentStreak;
            }
            return b.totalWorkoutsCompleted - a.totalWorkoutsCompleted;
        });
        return rankings;
    }
};
exports.GamificationService = GamificationService;
exports.GamificationService = GamificationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(penalty_record_schema_1.PenaltyRecord.name)),
    __param(1, (0, mongoose_1.InjectModel)(client_profile_schema_1.ClientProfile.name)),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => trainers_service_1.TrainersService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        clients_service_1.ClientsService,
        trainers_service_1.TrainersService])
], GamificationService);
//# sourceMappingURL=gamification.service.js.map