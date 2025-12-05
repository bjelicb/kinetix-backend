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
exports.SubscriptionUpdateDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const subscription_status_enum_1 = require("../../common/enums/subscription-status.enum");
class SubscriptionUpdateDto {
    subscriptionStatus;
    subscriptionTier;
    subscriptionExpiresAt;
    lastPaymentDate;
    isActive;
}
exports.SubscriptionUpdateDto = SubscriptionUpdateDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: subscription_status_enum_1.SubscriptionStatus, example: subscription_status_enum_1.SubscriptionStatus.ACTIVE, description: 'Subscription status' }),
    (0, class_validator_1.IsEnum)(subscription_status_enum_1.SubscriptionStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscriptionUpdateDto.prototype, "subscriptionStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'PREMIUM', description: 'Subscription tier' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscriptionUpdateDto.prototype, "subscriptionTier", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2025-12-31T00:00:00.000Z', description: 'Subscription expiration date' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscriptionUpdateDto.prototype, "subscriptionExpiresAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2025-01-01T00:00:00.000Z', description: 'Last payment date' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubscriptionUpdateDto.prototype, "lastPaymentDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'Whether the subscription is active' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], SubscriptionUpdateDto.prototype, "isActive", void 0);
//# sourceMappingURL=subscription-update.dto.js.map