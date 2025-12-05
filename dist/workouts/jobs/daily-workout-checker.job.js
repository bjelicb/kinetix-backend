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
exports.DailyWorkoutChecker = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const workouts_service_1 = require("../workouts.service");
let DailyWorkoutChecker = class DailyWorkoutChecker {
    workoutsService;
    constructor(workoutsService) {
        this.workoutsService = workoutsService;
    }
    async markOverdueWorkoutsAsMissed() {
        try {
            const count = await this.workoutsService.markMissedWorkouts();
            console.log(`[DailyWorkoutChecker] Marked ${count} workouts as missed`);
        }
        catch (error) {
            console.error('[DailyWorkoutChecker] Error marking missed workouts:', error);
        }
    }
};
exports.DailyWorkoutChecker = DailyWorkoutChecker;
__decorate([
    (0, schedule_1.Cron)('0 2 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DailyWorkoutChecker.prototype, "markOverdueWorkoutsAsMissed", null);
exports.DailyWorkoutChecker = DailyWorkoutChecker = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workouts_service_1.WorkoutsService])
], DailyWorkoutChecker);
//# sourceMappingURL=daily-workout-checker.job.js.map