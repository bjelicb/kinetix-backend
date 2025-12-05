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
exports.GamificationController = void 0;
const common_1 = require("@nestjs/common");
const gamification_service_1 = require("./gamification.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const saas_killswitch_guard_1 = require("../common/guards/saas-killswitch.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const user_role_enum_1 = require("../common/enums/user-role.enum");
let GamificationController = class GamificationController {
    gamificationService;
    constructor(gamificationService) {
        this.gamificationService = gamificationService;
    }
    async getPenaltyStatus(user) {
        return this.gamificationService.getPenaltyStatus(user.sub);
    }
    async getPenaltyHistory(user) {
        return this.gamificationService.getPenaltyHistory(user.sub);
    }
    async getLeaderboard(user) {
        return this.gamificationService.getLeaderboard(user.sub);
    }
    async resetPenalty(clientId, user) {
        await this.gamificationService.resetPenalty(clientId, user.sub);
        return { message: 'Penalty reset successfully' };
    }
};
exports.GamificationController = GamificationController;
__decorate([
    (0, common_1.Get)('status'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, common_1.UseGuards)(saas_killswitch_guard_1.SaasKillswitchGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GamificationController.prototype, "getPenaltyStatus", null);
__decorate([
    (0, common_1.Get)('penalties'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, common_1.UseGuards)(saas_killswitch_guard_1.SaasKillswitchGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GamificationController.prototype, "getPenaltyHistory", null);
__decorate([
    (0, common_1.Get)('leaderboard'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.TRAINER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GamificationController.prototype, "getLeaderboard", null);
__decorate([
    (0, common_1.Post)('reset-penalty/:clientId'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.TRAINER),
    __param(0, (0, common_1.Param)('clientId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GamificationController.prototype, "resetPenalty", null);
exports.GamificationController = GamificationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('gamification'),
    __metadata("design:paramtypes", [gamification_service_1.GamificationService])
], GamificationController);
//# sourceMappingURL=gamification.controller.js.map