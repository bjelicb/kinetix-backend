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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyPenaltyJob = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const penalty_record_schema_1 = require("../schemas/penalty-record.schema");
const client_profile_schema_1 = require("../../clients/schemas/client-profile.schema");
const workout_log_schema_1 = require("../../workouts/schemas/workout-log.schema");
const penalty_record_schema_2 = require("../schemas/penalty-record.schema");
const moment_1 = __importDefault(require("moment"));
let WeeklyPenaltyJob = class WeeklyPenaltyJob {
    penaltyRecordModel;
    clientProfileModel;
    workoutLogModel;
    constructor(penaltyRecordModel, clientProfileModel, workoutLogModel) {
        this.penaltyRecordModel = penaltyRecordModel;
        this.clientProfileModel = clientProfileModel;
        this.workoutLogModel = workoutLogModel;
    }
    async calculateWeeklyPenalties() {
        const lastWeekStart = (0, moment_1.default)().subtract(1, 'week').startOf('week').toDate();
        const lastWeekEnd = (0, moment_1.default)().subtract(1, 'week').endOf('week').toDate();
        const clients = await this.clientProfileModel.find({}).exec();
        for (const client of clients) {
            try {
                const missedCount = await this.workoutLogModel.countDocuments({
                    clientId: client._id,
                    workoutDate: {
                        $gte: lastWeekStart,
                        $lte: lastWeekEnd,
                    },
                    isMissed: true,
                }).exec();
                const totalScheduled = await this.workoutLogModel.countDocuments({
                    clientId: client._id,
                    workoutDate: {
                        $gte: lastWeekStart,
                        $lte: lastWeekEnd,
                    },
                }).exec();
                const completionRate = totalScheduled > 0 ? ((totalScheduled - missedCount) / totalScheduled) * 100 : 0;
                let penaltyType = penalty_record_schema_2.PenaltyType.NONE;
                let isPenaltyApplied = false;
                if (missedCount > 2) {
                    penaltyType = penalty_record_schema_2.PenaltyType.PENALTY_MODE;
                    isPenaltyApplied = true;
                    client.isPenaltyMode = true;
                    client.consecutiveMissedWorkouts += missedCount;
                    client.currentStreak = 0;
                }
                else if (missedCount > 0) {
                    penaltyType = penalty_record_schema_2.PenaltyType.WARNING;
                    client.isPenaltyMode = false;
                    client.consecutiveMissedWorkouts = 0;
                }
                else {
                    client.isPenaltyMode = false;
                    client.consecutiveMissedWorkouts = 0;
                }
                await this.penaltyRecordModel.findOneAndUpdate({
                    clientId: client._id,
                    weekStartDate: lastWeekStart,
                }, {
                    clientId: client._id,
                    trainerId: client.trainerId,
                    weekStartDate: lastWeekStart,
                    weekEndDate: lastWeekEnd,
                    totalMissedWorkouts: missedCount,
                    totalScheduledWorkouts: totalScheduled,
                    completionRate,
                    isPenaltyApplied,
                    penaltyType,
                }, { upsert: true, new: true }).exec();
                await client.save();
            }
            catch (error) {
                console.error(`Error processing penalty for client ${client._id}:`, error);
            }
        }
    }
};
exports.WeeklyPenaltyJob = WeeklyPenaltyJob;
__decorate([
    (0, schedule_1.Cron)('0 0 * * 1'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WeeklyPenaltyJob.prototype, "calculateWeeklyPenalties", null);
exports.WeeklyPenaltyJob = WeeklyPenaltyJob = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(penalty_record_schema_1.PenaltyRecord.name)),
    __param(1, (0, mongoose_1.InjectModel)(client_profile_schema_1.ClientProfile.name)),
    __param(2, (0, mongoose_1.InjectModel)(workout_log_schema_1.WorkoutLog.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], WeeklyPenaltyJob);
//# sourceMappingURL=weekly-penalty.job.js.map