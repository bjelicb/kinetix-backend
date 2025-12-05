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
exports.TrainersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const trainers_service_1 = require("./trainers.service");
const update_trainer_dto_1 = require("./dto/update-trainer.dto");
const subscription_update_dto_1 = require("./dto/subscription-update.dto");
const upgrade_subscription_dto_1 = require("./dto/upgrade-subscription.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let TrainersController = class TrainersController {
    trainersService;
    constructor(trainersService) {
        this.trainersService = trainersService;
    }
    async getProfile(user) {
        return this.trainersService.getProfile(user.sub);
    }
    async updateProfile(user, dto) {
        return this.trainersService.updateProfile(user.sub, dto);
    }
    async getClients(user) {
        return this.trainersService.getClients(user.sub);
    }
    async getSubscription(user) {
        const profile = await this.trainersService.getProfile(user.sub);
        return {
            subscriptionStatus: profile.subscriptionStatus,
            subscriptionTier: profile.subscriptionTier,
            subscriptionExpiresAt: profile.subscriptionExpiresAt,
            lastPaymentDate: profile.lastPaymentDate,
            isActive: profile.isActive,
        };
    }
    async updateSubscription(user, dto) {
        return this.trainersService.updateSubscription(user.sub, dto);
    }
    async assignClient(user, clientProfileId) {
        return this.trainersService.assignClientToTrainer(user.sub, clientProfileId);
    }
    async removeClient(user, clientProfileId) {
        return this.trainersService.removeClientFromTrainer(user.sub, clientProfileId);
    }
    async upgradeSubscription(user, dto) {
        return this.trainersService.upgradeSubscription(user.sub, dto);
    }
};
exports.TrainersController = TrainersController;
__decorate([
    (0, common_1.Get)('profile'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Get trainer profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Trainer profile retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Trainer role required' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TrainersController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('profile'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Update trainer profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Trainer profile updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Trainer role required' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_trainer_dto_1.UpdateTrainerDto]),
    __metadata("design:returntype", Promise)
], TrainersController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)('clients'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Get trainer clients list' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Clients list retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Trainer role required' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TrainersController.prototype, "getClients", null);
__decorate([
    (0, common_1.Get)('subscription'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Get trainer subscription details' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription details retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Trainer role required' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TrainersController.prototype, "getSubscription", null);
__decorate([
    (0, common_1.Patch)('subscription'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Update trainer subscription' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Trainer role required' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, subscription_update_dto_1.SubscriptionUpdateDto]),
    __metadata("design:returntype", Promise)
], TrainersController.prototype, "updateSubscription", null);
__decorate([
    (0, common_1.Post)('clients/:id/assign'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Assign client to trainer' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Client profile ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Client assigned successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request - Client already assigned or max clients reached' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Trainer role required' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Client not found' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TrainersController.prototype, "assignClient", null);
__decorate([
    (0, common_1.Delete)('clients/:id'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Remove client from trainer' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Client profile ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Client removed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Client does not belong to trainer' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Client not found' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TrainersController.prototype, "removeClient", null);
__decorate([
    (0, common_1.Post)('subscription/upgrade'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Upgrade subscription tier' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription upgraded successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request - Invalid tier upgrade' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Trainer role required' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upgrade_subscription_dto_1.UpgradeSubscriptionDto]),
    __metadata("design:returntype", Promise)
], TrainersController.prototype, "upgradeSubscription", null);
exports.TrainersController = TrainersController = __decorate([
    (0, swagger_1.ApiTags)('trainers'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('trainers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [trainers_service_1.TrainersService])
], TrainersController);
//# sourceMappingURL=trainers.controller.js.map