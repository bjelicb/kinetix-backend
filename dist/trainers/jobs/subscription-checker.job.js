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
exports.SubscriptionChecker = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const trainer_profile_schema_1 = require("../schemas/trainer-profile.schema");
const subscription_status_enum_1 = require("../../common/enums/subscription-status.enum");
let SubscriptionChecker = class SubscriptionChecker {
    trainerModel;
    constructor(trainerModel) {
        this.trainerModel = trainerModel;
    }
    async checkAndSuspendExpiredSubscriptions() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const result = await this.trainerModel.updateMany({
                subscriptionExpiresAt: { $lt: today },
                isActive: true,
            }, {
                $set: {
                    isActive: false,
                    subscriptionStatus: subscription_status_enum_1.SubscriptionStatus.SUSPENDED,
                },
            }).exec();
            console.log(`[SubscriptionChecker] Suspended ${result.modifiedCount} expired subscriptions`);
        }
        catch (error) {
            console.error('[SubscriptionChecker] Error checking subscriptions:', error);
        }
    }
};
exports.SubscriptionChecker = SubscriptionChecker;
__decorate([
    (0, schedule_1.Cron)('0 1 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionChecker.prototype, "checkAndSuspendExpiredSubscriptions", null);
exports.SubscriptionChecker = SubscriptionChecker = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(trainer_profile_schema_1.TrainerProfile.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], SubscriptionChecker);
//# sourceMappingURL=subscription-checker.job.js.map