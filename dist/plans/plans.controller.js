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
exports.PlansController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const plans_service_1 = require("./plans.service");
const create_plan_dto_1 = require("./dto/create-plan.dto");
const update_plan_dto_1 = require("./dto/update-plan.dto");
const assign_plan_dto_1 = require("./dto/assign-plan.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let PlansController = class PlansController {
    plansService;
    constructor(plansService) {
        this.plansService = plansService;
    }
    async createPlan(user, dto) {
        return this.plansService.createPlan(user.sub, dto);
    }
    async getPlans(user) {
        return this.plansService.getPlans(user.sub);
    }
    async getPlanById(id) {
        return this.plansService.getPlanById(id);
    }
    async updatePlan(user, id, dto) {
        return this.plansService.updatePlan(id, user.sub, dto);
    }
    async deletePlan(user, id) {
        await this.plansService.deletePlan(id, user.sub);
        return { message: 'Plan deleted successfully' };
    }
    async assignPlan(user, id, dto) {
        return this.plansService.assignPlanToClients(id, user.sub, dto);
    }
    async duplicatePlan(user, id) {
        return this.plansService.duplicatePlan(id, user.sub);
    }
};
exports.PlansController = PlansController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('TRAINER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_plan_dto_1.CreatePlanDto]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "createPlan", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('TRAINER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "getPlans", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "getPlanById", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_plan_dto_1.UpdatePlanDto]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "deletePlan", null);
__decorate([
    (0, common_1.Post)(':id/assign'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, assign_plan_dto_1.AssignPlanDto]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "assignPlan", null);
__decorate([
    (0, common_1.Post)(':id/duplicate'),
    (0, roles_decorator_1.Roles)('TRAINER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "duplicatePlan", null);
exports.PlansController = PlansController = __decorate([
    (0, swagger_1.ApiTags)('plans'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('plans'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [plans_service_1.PlansService])
], PlansController);
//# sourceMappingURL=plans.controller.js.map