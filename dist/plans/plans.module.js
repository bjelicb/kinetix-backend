"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlansModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const plans_service_1 = require("./plans.service");
const plans_controller_1 = require("./plans.controller");
const weekly_plan_schema_1 = require("./schemas/weekly-plan.schema");
const trainers_module_1 = require("../trainers/trainers.module");
const clients_module_1 = require("../clients/clients.module");
const workouts_module_1 = require("../workouts/workouts.module");
let PlansModule = class PlansModule {
};
exports.PlansModule = PlansModule;
exports.PlansModule = PlansModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: weekly_plan_schema_1.WeeklyPlan.name, schema: weekly_plan_schema_1.WeeklyPlanSchema },
            ]),
            trainers_module_1.TrainersModule,
            (0, common_1.forwardRef)(() => clients_module_1.ClientsModule),
            (0, common_1.forwardRef)(() => workouts_module_1.WorkoutsModule),
        ],
        controllers: [plans_controller_1.PlansController],
        providers: [plans_service_1.PlansService],
        exports: [plans_service_1.PlansService],
    })
], PlansModule);
//# sourceMappingURL=plans.module.js.map