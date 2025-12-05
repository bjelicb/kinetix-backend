"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkoutsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const workouts_service_1 = require("./workouts.service");
const workouts_controller_1 = require("./workouts.controller");
const workout_log_schema_1 = require("./schemas/workout-log.schema");
const checkin_schema_1 = require("../checkins/schemas/checkin.schema");
const common_module_1 = require("../common/common.module");
const clients_module_1 = require("../clients/clients.module");
const trainers_module_1 = require("../trainers/trainers.module");
const plans_module_1 = require("../plans/plans.module");
const daily_workout_checker_job_1 = require("./jobs/daily-workout-checker.job");
const cleanup_old_logs_job_1 = require("./jobs/cleanup-old-logs.job");
let WorkoutsModule = class WorkoutsModule {
};
exports.WorkoutsModule = WorkoutsModule;
exports.WorkoutsModule = WorkoutsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: workout_log_schema_1.WorkoutLog.name, schema: workout_log_schema_1.WorkoutLogSchema },
                { name: checkin_schema_1.CheckIn.name, schema: checkin_schema_1.CheckInSchema },
            ]),
            schedule_1.ScheduleModule.forRoot(),
            common_module_1.CommonModule,
            (0, common_1.forwardRef)(() => clients_module_1.ClientsModule),
            trainers_module_1.TrainersModule,
            (0, common_1.forwardRef)(() => plans_module_1.PlansModule),
        ],
        controllers: [workouts_controller_1.WorkoutsController],
        providers: [workouts_service_1.WorkoutsService, daily_workout_checker_job_1.DailyWorkoutChecker, cleanup_old_logs_job_1.CleanupOldLogs],
        exports: [workouts_service_1.WorkoutsService],
    })
], WorkoutsModule);
//# sourceMappingURL=workouts.module.js.map