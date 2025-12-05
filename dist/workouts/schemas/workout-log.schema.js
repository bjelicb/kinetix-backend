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
exports.WorkoutLogSchema = exports.WorkoutLog = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let WorkoutLog = class WorkoutLog {
    clientId;
    trainerId;
    weeklyPlanId;
    workoutDate;
    weekNumber;
    dayOfWeek;
    completedExercises;
    isCompleted;
    isMissed;
    completedAt;
    difficultyRating;
    clientNotes;
};
exports.WorkoutLog = WorkoutLog;
__decorate([
    (0, mongoose_1.Prop)({
        type: mongoose_2.Types.ObjectId,
        ref: 'ClientProfile',
        required: true,
    }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], WorkoutLog.prototype, "clientId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: mongoose_2.Types.ObjectId,
        ref: 'TrainerProfile',
        required: true,
    }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], WorkoutLog.prototype, "trainerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: mongoose_2.Types.ObjectId,
        ref: 'WeeklyPlan',
        required: true,
    }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], WorkoutLog.prototype, "weeklyPlanId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], WorkoutLog.prototype, "workoutDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], WorkoutLog.prototype, "weekNumber", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1, max: 7 }),
    __metadata("design:type", Number)
], WorkoutLog.prototype, "dayOfWeek", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                exerciseName: { type: String, required: true },
                actualSets: { type: Number, required: true },
                actualReps: { type: [Number], required: true },
                weightUsed: { type: Number },
                notes: { type: String },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], WorkoutLog.prototype, "completedExercises", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], WorkoutLog.prototype, "isCompleted", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], WorkoutLog.prototype, "isMissed", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], WorkoutLog.prototype, "completedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ min: 1, max: 5 }),
    __metadata("design:type", Number)
], WorkoutLog.prototype, "difficultyRating", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], WorkoutLog.prototype, "clientNotes", void 0);
exports.WorkoutLog = WorkoutLog = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], WorkoutLog);
exports.WorkoutLogSchema = mongoose_1.SchemaFactory.createForClass(WorkoutLog);
exports.WorkoutLogSchema.index({ clientId: 1, workoutDate: 1 }, { unique: true });
exports.WorkoutLogSchema.index({ trainerId: 1 });
exports.WorkoutLogSchema.index({ trainerId: 1, workoutDate: 1 });
exports.WorkoutLogSchema.index({ weeklyPlanId: 1 });
exports.WorkoutLogSchema.index({ isCompleted: 1 });
exports.WorkoutLogSchema.index({ isMissed: 1 });
//# sourceMappingURL=workout-log.schema.js.map