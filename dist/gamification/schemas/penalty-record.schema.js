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
exports.PenaltyRecordSchema = exports.PenaltyRecord = exports.PenaltyType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var PenaltyType;
(function (PenaltyType) {
    PenaltyType["WARNING"] = "WARNING";
    PenaltyType["PENALTY_MODE"] = "PENALTY_MODE";
    PenaltyType["NONE"] = "NONE";
})(PenaltyType || (exports.PenaltyType = PenaltyType = {}));
let PenaltyRecord = class PenaltyRecord {
    clientId;
    trainerId;
    weekStartDate;
    weekEndDate;
    totalMissedWorkouts;
    totalScheduledWorkouts;
    completionRate;
    isPenaltyApplied;
    penaltyType;
    trainerNotes;
};
exports.PenaltyRecord = PenaltyRecord;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ClientProfile', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PenaltyRecord.prototype, "clientId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'TrainerProfile', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PenaltyRecord.prototype, "trainerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], PenaltyRecord.prototype, "weekStartDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], PenaltyRecord.prototype, "weekEndDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], PenaltyRecord.prototype, "totalMissedWorkouts", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], PenaltyRecord.prototype, "totalScheduledWorkouts", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], PenaltyRecord.prototype, "completionRate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], PenaltyRecord.prototype, "isPenaltyApplied", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: PenaltyType,
        required: true,
    }),
    __metadata("design:type", String)
], PenaltyRecord.prototype, "penaltyType", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], PenaltyRecord.prototype, "trainerNotes", void 0);
exports.PenaltyRecord = PenaltyRecord = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], PenaltyRecord);
exports.PenaltyRecordSchema = mongoose_1.SchemaFactory.createForClass(PenaltyRecord);
exports.PenaltyRecordSchema.index({ clientId: 1, weekStartDate: 1 }, { unique: true });
//# sourceMappingURL=penalty-record.schema.js.map