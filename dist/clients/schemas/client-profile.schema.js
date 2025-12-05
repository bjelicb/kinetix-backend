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
exports.ClientProfileSchema = exports.ClientProfile = exports.ActivityLevel = exports.FitnessGoal = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var FitnessGoal;
(function (FitnessGoal) {
    FitnessGoal["WEIGHT_LOSS"] = "WEIGHT_LOSS";
    FitnessGoal["MUSCLE_GAIN"] = "MUSCLE_GAIN";
    FitnessGoal["ENDURANCE"] = "ENDURANCE";
    FitnessGoal["GENERAL_FITNESS"] = "GENERAL_FITNESS";
})(FitnessGoal || (exports.FitnessGoal = FitnessGoal = {}));
var ActivityLevel;
(function (ActivityLevel) {
    ActivityLevel["SEDENTARY"] = "SEDENTARY";
    ActivityLevel["LIGHT"] = "LIGHT";
    ActivityLevel["MODERATE"] = "MODERATE";
    ActivityLevel["VERY_ACTIVE"] = "VERY_ACTIVE";
})(ActivityLevel || (exports.ActivityLevel = ActivityLevel = {}));
let ClientProfile = class ClientProfile {
    userId;
    trainerId;
    age;
    weight;
    height;
    fitnessGoal;
    activityLevel;
    currentPlanId;
    planStartDate;
    planEndDate;
    isPenaltyMode;
    consecutiveMissedWorkouts;
    totalWorkoutsCompleted;
    currentStreak;
    medicalConditions;
    notes;
};
exports.ClientProfile = ClientProfile;
__decorate([
    (0, mongoose_1.Prop)({
        type: mongoose_2.Types.ObjectId,
        ref: 'User',
        required: true,
    }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ClientProfile.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: mongoose_2.Types.ObjectId,
        ref: 'TrainerProfile',
        required: true,
    }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ClientProfile.prototype, "trainerId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], ClientProfile.prototype, "age", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], ClientProfile.prototype, "weight", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], ClientProfile.prototype, "height", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: FitnessGoal,
    }),
    __metadata("design:type", String)
], ClientProfile.prototype, "fitnessGoal", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: ActivityLevel,
    }),
    __metadata("design:type", String)
], ClientProfile.prototype, "activityLevel", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: mongoose_2.Types.ObjectId,
        ref: 'WeeklyPlan',
    }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ClientProfile.prototype, "currentPlanId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ClientProfile.prototype, "planStartDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ClientProfile.prototype, "planEndDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], ClientProfile.prototype, "isPenaltyMode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ClientProfile.prototype, "consecutiveMissedWorkouts", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ClientProfile.prototype, "totalWorkoutsCompleted", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ClientProfile.prototype, "currentStreak", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ClientProfile.prototype, "medicalConditions", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ClientProfile.prototype, "notes", void 0);
exports.ClientProfile = ClientProfile = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], ClientProfile);
exports.ClientProfileSchema = mongoose_1.SchemaFactory.createForClass(ClientProfile);
exports.ClientProfileSchema.index({ userId: 1 }, { unique: true });
exports.ClientProfileSchema.index({ trainerId: 1 });
exports.ClientProfileSchema.index({ trainerId: 1, currentPlanId: 1 });
exports.ClientProfileSchema.index({ currentPlanId: 1 });
//# sourceMappingURL=client-profile.schema.js.map