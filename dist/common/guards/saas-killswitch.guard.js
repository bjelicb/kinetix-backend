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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaasKillswitchGuard = void 0;
const common_1 = require("@nestjs/common");
const clients_service_1 = require("../../clients/clients.service");
const trainers_service_1 = require("../../trainers/trainers.service");
const subscription_status_enum_1 = require("../enums/subscription-status.enum");
let SaasKillswitchGuard = class SaasKillswitchGuard {
    clientsService;
    trainersService;
    constructor(clientsService, trainersService) {
        this.clientsService = clientsService;
        this.trainersService = trainersService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user || user.role !== 'CLIENT') {
            return true;
        }
        try {
            const client = await this.clientsService.getProfile(user.sub);
            if (!client) {
                throw new common_1.UnauthorizedException('Client profile not found');
            }
            let trainerId;
            if (client.trainerId && typeof client.trainerId === 'object' && client.trainerId._id) {
                trainerId = client.trainerId._id.toString();
            }
            else if (client.trainerId && typeof client.trainerId === 'object') {
                trainerId = client.trainerId.toString();
            }
            else {
                trainerId = String(client.trainerId);
            }
            const trainer = await this.trainersService.getProfileById(trainerId);
            if (!trainer) {
                throw new common_1.UnauthorizedException('Trainer profile not found');
            }
            if (!trainer.isActive || trainer.subscriptionStatus !== subscription_status_enum_1.SubscriptionStatus.ACTIVE) {
                throw new common_1.ForbiddenException("Access denied. Your trainer's subscription is inactive.");
            }
            if (trainer.subscriptionExpiresAt < new Date()) {
                await this.trainersService.updateSubscription(trainer.userId.toString(), {
                    subscriptionStatus: subscription_status_enum_1.SubscriptionStatus.SUSPENDED,
                });
                await this.trainersService.updateProfile(trainer.userId.toString(), {
                    isActive: false,
                });
                throw new common_1.ForbiddenException('Access denied. Subscription has expired.');
            }
            return true;
        }
        catch (error) {
            if (error instanceof common_1.ForbiddenException || error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            if (error instanceof common_1.NotFoundException) {
                throw new common_1.UnauthorizedException('Trainer or client profile not found');
            }
            console.error('[SaasKillswitchGuard] Error:', error);
            throw new common_1.UnauthorizedException('Unable to verify subscription status');
        }
    }
};
exports.SaasKillswitchGuard = SaasKillswitchGuard;
exports.SaasKillswitchGuard = SaasKillswitchGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [clients_service_1.ClientsService,
        trainers_service_1.TrainersService])
], SaasKillswitchGuard);
//# sourceMappingURL=saas-killswitch.guard.js.map