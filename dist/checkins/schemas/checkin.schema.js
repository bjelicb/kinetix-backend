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
exports.CheckInSchema = exports.CheckIn = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const verification_status_enum_1 = require("../../common/enums/verification-status.enum");
let GpsCoordinates = class GpsCoordinates {
    latitude;
    longitude;
    accuracy;
};
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], GpsCoordinates.prototype, "latitude", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], GpsCoordinates.prototype, "longitude", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], GpsCoordinates.prototype, "accuracy", void 0);
GpsCoordinates = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], GpsCoordinates);
const GpsCoordinatesSchema = mongoose_1.SchemaFactory.createForClass(GpsCoordinates);
let CheckIn = class CheckIn {
    clientId;
    trainerId;
    workoutLogId;
    checkinDate;
    photoUrl;
    thumbnailUrl;
    gpsCoordinates;
    verificationStatus;
    verifiedBy;
    verifiedAt;
    rejectionReason;
    aiConfidenceScore;
    detectedActivities;
    isGymLocation;
    clientNotes;
};
exports.CheckIn = CheckIn;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ClientProfile', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CheckIn.prototype, "clientId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'TrainerProfile', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CheckIn.prototype, "trainerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'WorkoutLog' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CheckIn.prototype, "workoutLogId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], CheckIn.prototype, "checkinDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CheckIn.prototype, "photoUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CheckIn.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: GpsCoordinatesSchema, required: true }),
    __metadata("design:type", GpsCoordinates)
], CheckIn.prototype, "gpsCoordinates", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: verification_status_enum_1.VerificationStatus,
        default: verification_status_enum_1.VerificationStatus.PENDING,
    }),
    __metadata("design:type", String)
], CheckIn.prototype, "verificationStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CheckIn.prototype, "verifiedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], CheckIn.prototype, "verifiedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CheckIn.prototype, "rejectionReason", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], CheckIn.prototype, "aiConfidenceScore", void 0);
__decorate([
    (0, mongoose_1.Prop)([String]),
    __metadata("design:type", Array)
], CheckIn.prototype, "detectedActivities", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Boolean)
], CheckIn.prototype, "isGymLocation", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CheckIn.prototype, "clientNotes", void 0);
exports.CheckIn = CheckIn = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], CheckIn);
exports.CheckInSchema = mongoose_1.SchemaFactory.createForClass(CheckIn);
exports.CheckInSchema.index({ clientId: 1, checkinDate: 1 }, { unique: true });
exports.CheckInSchema.index({ trainerId: 1, verificationStatus: 1 });
//# sourceMappingURL=checkin.schema.js.map