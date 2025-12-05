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
exports.TrainerProfileSchema = exports.TrainerProfile = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const subscription_status_enum_1 = require("../../common/enums/subscription-status.enum");
let TrainerProfile = class TrainerProfile {
    userId;
    isActive;
    subscriptionStatus;
    subscriptionTier;
    subscriptionExpiresAt;
    lastPaymentDate;
    businessName;
    bio;
    certifications;
    specializations;
    yearsExperience;
    clientIds;
    maxClients;
    stripeCustomerId;
    stripeSubscriptionId;
};
exports.TrainerProfile = TrainerProfile;
__decorate([
    (0, mongoose_1.Prop)({
        type: mongoose_2.Types.ObjectId,
        ref: 'User',
        required: true,
    }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], TrainerProfile.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: true }),
    __metadata("design:type", Boolean)
], TrainerProfile.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: subscription_status_enum_1.SubscriptionStatus,
        default: subscription_status_enum_1.SubscriptionStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], TrainerProfile.prototype, "subscriptionStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: ['BASIC', 'PRO', 'ENTERPRISE'],
        default: 'BASIC',
    }),
    __metadata("design:type", String)
], TrainerProfile.prototype, "subscriptionTier", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], TrainerProfile.prototype, "subscriptionExpiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], TrainerProfile.prototype, "lastPaymentDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], TrainerProfile.prototype, "businessName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ maxlength: 500 }),
    __metadata("design:type", String)
], TrainerProfile.prototype, "bio", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], TrainerProfile.prototype, "certifications", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], TrainerProfile.prototype, "specializations", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], TrainerProfile.prototype, "yearsExperience", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [mongoose_2.Types.ObjectId], ref: 'ClientProfile', default: [] }),
    __metadata("design:type", Array)
], TrainerProfile.prototype, "clientIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 10 }),
    __metadata("design:type", Number)
], TrainerProfile.prototype, "maxClients", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], TrainerProfile.prototype, "stripeCustomerId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], TrainerProfile.prototype, "stripeSubscriptionId", void 0);
exports.TrainerProfile = TrainerProfile = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], TrainerProfile);
exports.TrainerProfileSchema = mongoose_1.SchemaFactory.createForClass(TrainerProfile);
exports.TrainerProfileSchema.index({ userId: 1 }, { unique: true });
exports.TrainerProfileSchema.index({ isActive: 1 });
exports.TrainerProfileSchema.index({ subscriptionExpiresAt: 1 });
//# sourceMappingURL=trainer-profile.schema.js.map