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
exports.CleanupOldLogs = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const workout_log_schema_1 = require("../schemas/workout-log.schema");
const checkin_schema_1 = require("../../checkins/schemas/checkin.schema");
const moment_1 = __importDefault(require("moment"));
let CleanupOldLogs = class CleanupOldLogs {
    workoutLogModel;
    checkInModel;
    constructor(workoutLogModel, checkInModel) {
        this.workoutLogModel = workoutLogModel;
        this.checkInModel = checkInModel;
    }
    async cleanupOldLogs() {
        try {
            const cutoffDate = (0, moment_1.default)().subtract(90, 'days').toDate();
            const workoutResult = await this.workoutLogModel.deleteMany({
                createdAt: { $lt: cutoffDate },
            }).exec();
            const checkInResult = await this.checkInModel.deleteMany({
                createdAt: { $lt: cutoffDate },
            }).exec();
            console.log(`[CleanupOldLogs] Deleted ${workoutResult.deletedCount} workout logs and ${checkInResult.deletedCount} check-ins older than 90 days`);
        }
        catch (error) {
            console.error('[CleanupOldLogs] Error cleaning up old logs:', error);
        }
    }
};
exports.CleanupOldLogs = CleanupOldLogs;
__decorate([
    (0, schedule_1.Cron)('0 3 * * 0'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CleanupOldLogs.prototype, "cleanupOldLogs", null);
exports.CleanupOldLogs = CleanupOldLogs = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(workout_log_schema_1.WorkoutLog.name)),
    __param(1, (0, mongoose_1.InjectModel)(checkin_schema_1.CheckIn.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], CleanupOldLogs);
//# sourceMappingURL=cleanup-old-logs.job.js.map