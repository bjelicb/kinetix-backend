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
exports.WeeklyPlanSchema = exports.WeeklyPlan = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const workout_difficulty_enum_1 = require("../../common/enums/workout-difficulty.enum");
let WeeklyPlan = class WeeklyPlan {
    trainerId;
    name;
    description;
    difficulty;
    workouts;
    assignedClientIds;
    isTemplate;
};
exports.WeeklyPlan = WeeklyPlan;
__decorate([
    (0, mongoose_1.Prop)({
        type: mongoose_2.Types.ObjectId,
        ref: 'TrainerProfile',
        required: true,
    }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], WeeklyPlan.prototype, "trainerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], WeeklyPlan.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], WeeklyPlan.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: workout_difficulty_enum_1.WorkoutDifficulty,
        default: workout_difficulty_enum_1.WorkoutDifficulty.INTERMEDIATE,
    }),
    __metadata("design:type", String)
], WeeklyPlan.prototype, "difficulty", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                dayOfWeek: { type: Number, required: true, min: 1, max: 7 },
                isRestDay: { type: Boolean, default: false },
                name: { type: String, required: true },
                exercises: {
                    type: [
                        {
                            name: { type: String, required: true },
                            sets: { type: Number, required: true },
                            reps: { type: String, required: true },
                            restSeconds: { type: Number, default: 60 },
                            notes: { type: String },
                            videoUrl: { type: String },
                        },
                    ],
                    default: [],
                },
                estimatedDuration: { type: Number, default: 60 },
                notes: { type: String },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], WeeklyPlan.prototype, "workouts", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [mongoose_2.Types.ObjectId],
        ref: 'ClientProfile',
        default: [],
    }),
    __metadata("design:type", Array)
], WeeklyPlan.prototype, "assignedClientIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], WeeklyPlan.prototype, "isTemplate", void 0);
exports.WeeklyPlan = WeeklyPlan = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], WeeklyPlan);
exports.WeeklyPlanSchema = mongoose_1.SchemaFactory.createForClass(WeeklyPlan);
exports.WeeklyPlanSchema.index({ trainerId: 1 });
exports.WeeklyPlanSchema.index({ trainerId: 1, isTemplate: 1 });
exports.WeeklyPlanSchema.index({ isTemplate: 1 });
//# sourceMappingURL=weekly-plan.schema.js.map