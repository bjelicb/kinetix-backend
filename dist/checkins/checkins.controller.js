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
exports.CheckInsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const checkins_service_1 = require("./checkins.service");
const create_checkin_dto_1 = require("./dto/create-checkin.dto");
const verify_checkin_dto_1 = require("./dto/verify-checkin.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const saas_killswitch_guard_1 = require("../common/guards/saas-killswitch.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const user_role_enum_1 = require("../common/enums/user-role.enum");
let CheckInsController = class CheckInsController {
    checkInsService;
    constructor(checkInsService) {
        this.checkInsService = checkInsService;
    }
    async createCheckIn(user, createCheckInDto) {
        return this.checkInsService.createCheckIn(user.sub, createCheckInDto);
    }
    async getCheckInsByClient(user) {
        return this.checkInsService.getCheckInsByClient(user.sub);
    }
    async getPendingCheckIns(trainerId) {
        return this.checkInsService.getPendingCheckIns(trainerId);
    }
    async getCheckInById(id) {
        return this.checkInsService.getCheckInById(id);
    }
    async verifyCheckIn(id, user, verifyCheckInDto) {
        return this.checkInsService.verifyCheckIn(id, user.sub, verifyCheckInDto);
    }
    async getCheckInsByDateRange(user, startDate, endDate) {
        return this.checkInsService.getCheckInsByDateRange(user.sub, new Date(startDate), new Date(endDate));
    }
    async deleteCheckIn(user, checkInId) {
        await this.checkInsService.deleteCheckIn(checkInId, user.sub);
        return { message: 'Check-in deleted successfully' };
    }
};
exports.CheckInsController = CheckInsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, common_1.UseGuards)(saas_killswitch_guard_1.SaasKillswitchGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_checkin_dto_1.CreateCheckInDto]),
    __metadata("design:returntype", Promise)
], CheckInsController.prototype, "createCheckIn", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, common_1.UseGuards)(saas_killswitch_guard_1.SaasKillswitchGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CheckInsController.prototype, "getCheckInsByClient", null);
__decorate([
    (0, common_1.Get)('pending'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.TRAINER),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CheckInsController.prototype, "getPendingCheckIns", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT, user_role_enum_1.UserRole.TRAINER),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CheckInsController.prototype, "getCheckInById", null);
__decorate([
    (0, common_1.Patch)(':id/verify'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.TRAINER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, verify_checkin_dto_1.VerifyCheckInDto]),
    __metadata("design:returntype", Promise)
], CheckInsController.prototype, "verifyCheckIn", null);
__decorate([
    (0, common_1.Get)('range/start/:startDate/end/:endDate'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, common_1.UseGuards)(saas_killswitch_guard_1.SaasKillswitchGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('startDate')),
    __param(2, (0, common_1.Param)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CheckInsController.prototype, "getCheckInsByDateRange", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CLIENT),
    (0, common_1.UseGuards)(saas_killswitch_guard_1.SaasKillswitchGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Delete check-in' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Check-in ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Check-in deleted successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden - Can only delete own check-ins' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Check-in not found' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CheckInsController.prototype, "deleteCheckIn", null);
exports.CheckInsController = CheckInsController = __decorate([
    (0, swagger_1.ApiTags)('checkins'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('checkins'),
    __metadata("design:paramtypes", [checkins_service_1.CheckInsService])
], CheckInsController);
//# sourceMappingURL=checkins.controller.js.map