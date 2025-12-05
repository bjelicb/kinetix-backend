"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamificationModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const gamification_service_1 = require("./gamification.service");
const gamification_controller_1 = require("./gamification.controller");
const penalty_record_schema_1 = require("./schemas/penalty-record.schema");
const weekly_penalty_job_1 = require("./jobs/weekly-penalty.job");
const common_module_1 = require("../common/common.module");
const clients_module_1 = require("../clients/clients.module");
const trainers_module_1 = require("../trainers/trainers.module");
const client_profile_schema_1 = require("../clients/schemas/client-profile.schema");
const workout_log_schema_1 = require("../workouts/schemas/workout-log.schema");
let GamificationModule = class GamificationModule {
};
exports.GamificationModule = GamificationModule;
exports.GamificationModule = GamificationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: penalty_record_schema_1.PenaltyRecord.name, schema: penalty_record_schema_1.PenaltyRecordSchema },
                { name: client_profile_schema_1.ClientProfile.name, schema: client_profile_schema_1.ClientProfileSchema },
                { name: workout_log_schema_1.WorkoutLog.name, schema: workout_log_schema_1.WorkoutLogSchema },
            ]),
            schedule_1.ScheduleModule.forRoot(),
            common_module_1.CommonModule,
            clients_module_1.ClientsModule,
            trainers_module_1.TrainersModule,
        ],
        controllers: [gamification_controller_1.GamificationController],
        providers: [gamification_service_1.GamificationService, weekly_penalty_job_1.WeeklyPenaltyJob],
        exports: [gamification_service_1.GamificationService],
    })
], GamificationModule);
//# sourceMappingURL=gamification.module.js.map