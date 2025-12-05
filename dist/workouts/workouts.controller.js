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
exports.WorkoutsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const workouts_service_1 = require("./workouts.service");
const log_workout_dto_1 = require("./dto/log-workout.dto");
const update_workout_log_dto_1 = require("./dto/update-workout-log.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const saas_killswitch_guard_1 = require("../common/guards/saas-killswitch.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let WorkoutsController = class WorkoutsController {
    workoutsService;
    constructor(workoutsService) {
        this.workoutsService = workoutsService;
    }
    async logWorkout(user, dto) {
        return this.workoutsService.logWorkout(user.sub, dto);
    }
    async updateWorkoutLog(id, dto) {
        return this.workoutsService.updateWorkoutLog(id, dto);
    }
    async getTodayWorkout(user) {
        return this.workoutsService.getTodayWorkout(user.sub);
    }
    async getWorkoutById(id) {
        return this.workoutsService.getWorkoutById(id);
    }
    async getWeekWorkouts(user, date) {
        const dateObj = new Date(date);
        return this.workoutsService.getWeekWorkouts(user.sub, dateObj);
    }
};
exports.WorkoutsController = WorkoutsController;
__decorate([
    (0, common_1.Post)('log'),
    (0, roles_decorator_1.Roles)('CLIENT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, log_workout_dto_1.LogWorkoutDto]),
    __metadata("design:returntype", Promise)
], WorkoutsController.prototype, "logWorkout", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('CLIENT'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_workout_log_dto_1.UpdateWorkoutLogDto]),
    __metadata("design:returntype", Promise)
], WorkoutsController.prototype, "updateWorkoutLog", null);
__decorate([
    (0, common_1.Get)('today'),
    (0, roles_decorator_1.Roles)('CLIENT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WorkoutsController.prototype, "getTodayWorkout", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('CLIENT'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkoutsController.prototype, "getWorkoutById", null);
__decorate([
    (0, common_1.Get)('week/:date'),
    (0, roles_decorator_1.Roles)('CLIENT'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WorkoutsController.prototype, "getWeekWorkouts", null);
exports.WorkoutsController = WorkoutsController = __decorate([
    (0, swagger_1.ApiTags)('workouts'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('workouts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, saas_killswitch_guard_1.SaasKillswitchGuard),
    __metadata("design:paramtypes", [workouts_service_1.WorkoutsService])
], WorkoutsController);
//# sourceMappingURL=workouts.controller.js.map