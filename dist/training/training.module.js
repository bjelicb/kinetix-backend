"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const training_service_1 = require("./training.service");
const training_controller_1 = require("./training.controller");
const common_module_1 = require("../common/common.module");
const clients_module_1 = require("../clients/clients.module");
const trainers_module_1 = require("../trainers/trainers.module");
const workouts_module_1 = require("../workouts/workouts.module");
const checkins_module_1 = require("../checkins/checkins.module");
const workout_log_schema_1 = require("../workouts/schemas/workout-log.schema");
const checkin_schema_1 = require("../checkins/schemas/checkin.schema");
let TrainingModule = class TrainingModule {
};
exports.TrainingModule = TrainingModule;
exports.TrainingModule = TrainingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            common_module_1.CommonModule,
            clients_module_1.ClientsModule,
            trainers_module_1.TrainersModule,
            workouts_module_1.WorkoutsModule,
            checkins_module_1.CheckInsModule,
            mongoose_1.MongooseModule.forFeature([
                { name: workout_log_schema_1.WorkoutLog.name, schema: workout_log_schema_1.WorkoutLogSchema },
                { name: checkin_schema_1.CheckIn.name, schema: checkin_schema_1.CheckInSchema },
            ]),
        ],
        controllers: [training_controller_1.TrainingController],
        providers: [training_service_1.TrainingService],
        exports: [training_service_1.TrainingService],
    })
], TrainingModule);
//# sourceMappingURL=training.module.js.map