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
exports.TrainersService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const trainer_profile_schema_1 = require("./schemas/trainer-profile.schema");
const client_profile_schema_1 = require("../clients/schemas/client-profile.schema");
const subscription_status_enum_1 = require("../common/enums/subscription-status.enum");
let TrainersService = class TrainersService {
    trainerModel;
    clientModel;
    constructor(trainerModel, clientModel) {
        this.trainerModel = trainerModel;
        this.clientModel = clientModel;
    }
    async createProfile(userId, dto) {
        const subscriptionExpiresAt = new Date();
        subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 30);
        const trainerProfile = new this.trainerModel({
            userId: new mongoose_2.Types.ObjectId(userId),
            ...dto,
            subscriptionExpiresAt,
            isActive: true,
            subscriptionStatus: subscription_status_enum_1.SubscriptionStatus.ACTIVE,
        });
        return trainerProfile.save();
    }
    async getProfile(userId) {
        const profile = await this.trainerModel
            .findOne({ userId: new mongoose_2.Types.ObjectId(userId) })
            .populate('userId', 'email firstName lastName')
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('Trainer profile not found');
        }
        return profile;
    }
    async getProfileById(profileId) {
        const profile = await this.trainerModel
            .findById(profileId)
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('Trainer profile not found');
        }
        return profile;
    }
    async updateProfile(userId, dto) {
        const profile = await this.trainerModel
            .findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: dto }, { new: true })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('Trainer profile not found');
        }
        return profile;
    }
    async getClients(userId) {
        const profile = await this.getProfile(userId);
        const trainerProfileId = profile._id;
        const clients = await this.clientModel
            .find({ trainerId: trainerProfileId })
            .populate('userId', 'email firstName lastName')
            .populate('currentPlanId', 'name')
            .exec();
        return clients.map((client) => ({
            _id: client._id,
            userId: client.userId,
            trainerId: client.trainerId,
            currentPlanId: client.currentPlanId,
            fitnessGoal: client.fitnessGoal,
            activityLevel: client.activityLevel,
            totalWorkoutsCompleted: client.totalWorkoutsCompleted,
            currentStreak: client.currentStreak,
            isPenaltyMode: client.isPenaltyMode,
        }));
    }
    async updateSubscription(userId, dto) {
        const updateData = {};
        if (dto.subscriptionStatus) {
            updateData.subscriptionStatus = dto.subscriptionStatus;
        }
        if (dto.subscriptionTier) {
            updateData.subscriptionTier = dto.subscriptionTier;
        }
        if (dto.subscriptionExpiresAt) {
            updateData.subscriptionExpiresAt = new Date(dto.subscriptionExpiresAt);
        }
        if (dto.lastPaymentDate) {
            updateData.lastPaymentDate = new Date(dto.lastPaymentDate);
        }
        if (dto.isActive !== undefined) {
            updateData.isActive = dto.isActive;
        }
        const profile = await this.trainerModel
            .findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, { $set: updateData }, { new: true })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException('Trainer profile not found');
        }
        return profile;
    }
    async assignClientToTrainer(userId, clientProfileId) {
        const trainerProfile = await this.getProfile(userId);
        const trainerProfileId = trainerProfile._id;
        const currentClients = await this.clientModel.countDocuments({
            trainerId: trainerProfileId,
        }).exec();
        if (currentClients >= trainerProfile.maxClients) {
            throw new common_1.BadRequestException(`Maximum number of clients (${trainerProfile.maxClients}) reached. Please upgrade your subscription.`);
        }
        const clientProfile = await this.clientModel.findById(clientProfileId).exec();
        if (!clientProfile) {
            throw new common_1.NotFoundException('Client profile not found');
        }
        if (clientProfile.trainerId && clientProfile.trainerId.toString() !== trainerProfileId.toString()) {
            throw new common_1.BadRequestException('Client is already assigned to another trainer');
        }
        if (clientProfile.trainerId && clientProfile.trainerId.toString() === trainerProfileId.toString()) {
            return {
                message: 'Client already assigned to this trainer',
                clientId: clientProfileId,
            };
        }
        await this.clientModel.findByIdAndUpdate(clientProfileId, { $set: { trainerId: trainerProfileId } }).exec();
        await this.trainerModel.findByIdAndUpdate(trainerProfileId, { $addToSet: { clientIds: new mongoose_2.Types.ObjectId(clientProfileId) } }).exec();
        return {
            message: 'Client assigned successfully',
            clientId: clientProfileId,
        };
    }
    async removeClientFromTrainer(userId, clientProfileId) {
        const trainerProfile = await this.getProfile(userId);
        const trainerProfileId = trainerProfile._id;
        const clientProfile = await this.clientModel.findById(clientProfileId).exec();
        if (!clientProfile) {
            throw new common_1.NotFoundException('Client profile not found');
        }
        if (!clientProfile.trainerId || clientProfile.trainerId.toString() !== trainerProfileId.toString()) {
            throw new common_1.ForbiddenException('Client does not belong to this trainer');
        }
        await this.clientModel.findByIdAndUpdate(clientProfileId, { $set: { trainerId: null } }).exec();
        await this.trainerModel.findByIdAndUpdate(trainerProfileId, { $pull: { clientIds: new mongoose_2.Types.ObjectId(clientProfileId) } }).exec();
        return {
            message: 'Client removed successfully',
            clientId: clientProfileId,
        };
    }
    async upgradeSubscription(userId, dto) {
        const trainerProfile = await this.getProfile(userId);
        const currentTier = trainerProfile.subscriptionTier;
        const tierHierarchy = {
            BASIC: 1,
            PRO: 2,
            ENTERPRISE: 3,
        };
        const currentTierLevel = tierHierarchy[currentTier] || 0;
        const newTierLevel = tierHierarchy[dto.newTier];
        if (newTierLevel <= currentTierLevel) {
            throw new common_1.BadRequestException(`Cannot upgrade to ${dto.newTier}. Current tier is ${currentTier}. You can only upgrade to a higher tier.`);
        }
        const maxClientsByTier = {
            BASIC: 10,
            PRO: 50,
            ENTERPRISE: 999,
        };
        const newMaxClients = maxClientsByTier[dto.newTier];
        const updatedProfile = await this.trainerModel
            .findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId) }, {
            $set: {
                subscriptionTier: dto.newTier,
                maxClients: newMaxClients,
            },
        }, { new: true })
            .exec();
        if (!updatedProfile) {
            throw new common_1.NotFoundException('Trainer profile not found');
        }
        return updatedProfile;
    }
};
exports.TrainersService = TrainersService;
exports.TrainersService = TrainersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(trainer_profile_schema_1.TrainerProfile.name)),
    __param(1, (0, mongoose_1.InjectModel)(client_profile_schema_1.ClientProfile.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], TrainersService);
//# sourceMappingURL=trainers.service.js.map