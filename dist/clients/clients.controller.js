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
exports.ClientsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const clients_service_1 = require("./clients.service");
const workouts_service_1 = require("../workouts/workouts.service");
const update_client_dto_1 = require("./dto/update-client.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const saas_killswitch_guard_1 = require("../common/guards/saas-killswitch.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const user_role_enum_1 = require("../common/enums/user-role.enum");
let ClientsController = class ClientsController {
    clientsService;
    workoutsService;
    constructor(clientsService, workoutsService) {
        this.clientsService = clientsService;
        this.workoutsService = workoutsService;
    }
    async getProfile(user) {
        return this.clientsService.getProfile(user.sub);
    }
    async updateProfile(user, dto) {
        return this.clientsService.updateProfile(user.sub, dto);
    }
    async getCurrentPlan(user) {
        return this.clientsService.getCurrentPlan(user.sub);
    }
    async getUpcomingWorkouts(user) {
        const today = new Date();
        return this.workoutsService.getWeekWorkouts(user.sub, today);
    }
    async getWorkoutHistory(user) {
        return this.workoutsService.getWorkoutHistory(user.sub);
    }
    async getTrainer(user) {
        const profile = await this.clientsService.getProfile(user.sub);
        const trainerId = profile.trainerId
            ? (profile.trainerId?._id
                ? profile.trainerId._id.toString()
                : profile.trainerId.toString())
            : null;
        return { id: trainerId };
    }
    async getStats(user) {
        return this.clientsService.getStats(user.sub);
    }
};
exports.ClientsController = ClientsController;
__decorate([
    (0, common_1.Get)('profile'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Get client profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Client profile retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Client role required or subscription inactive' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('profile'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Update client profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Client profile updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Client role required or subscription inactive' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_client_dto_1.UpdateClientDto]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)('current-plan'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Get current workout plan' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Current plan retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Client role required or subscription inactive' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getCurrentPlan", null);
__decorate([
    (0, common_1.Get)('workouts/upcoming'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Get upcoming workouts for the week' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Upcoming workouts retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Client role required or subscription inactive' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getUpcomingWorkouts", null);
__decorate([
    (0, common_1.Get)('workouts/history'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Get workout history' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Workout history retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Client role required or subscription inactive' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getWorkoutHistory", null);
__decorate([
    (0, common_1.Get)('trainer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Get assigned trainer information' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Trainer information retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Client role required or subscription inactive' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getTrainer", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Get client workout statistics' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Statistics retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Client role required or subscription inactive' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getStats", null);
exports.ClientsController = ClientsController = __decorate([
    (0, swagger_1.ApiTags)('clients'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('clients'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, saas_killswitch_guard_1.SaasKillswitchGuard),
    __metadata("design:paramtypes", [clients_service_1.ClientsService,
        workouts_service_1.WorkoutsService])
], ClientsController);
//# sourceMappingURL=clients.controller.js.map