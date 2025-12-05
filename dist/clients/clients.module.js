"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const clients_service_1 = require("./clients.service");
const clients_controller_1 = require("./clients.controller");
const client_profile_schema_1 = require("./schemas/client-profile.schema");
const common_module_1 = require("../common/common.module");
const users_module_1 = require("../users/users.module");
const trainers_module_1 = require("../trainers/trainers.module");
const workouts_module_1 = require("../workouts/workouts.module");
const plans_module_1 = require("../plans/plans.module");
let ClientsModule = class ClientsModule {
};
exports.ClientsModule = ClientsModule;
exports.ClientsModule = ClientsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: client_profile_schema_1.ClientProfile.name, schema: client_profile_schema_1.ClientProfileSchema },
            ]),
            (0, common_1.forwardRef)(() => common_module_1.CommonModule),
            users_module_1.UsersModule,
            trainers_module_1.TrainersModule,
            (0, common_1.forwardRef)(() => workouts_module_1.WorkoutsModule),
            (0, common_1.forwardRef)(() => plans_module_1.PlansModule),
        ],
        controllers: [clients_controller_1.ClientsController],
        providers: [clients_service_1.ClientsService],
        exports: [clients_service_1.ClientsService],
    })
], ClientsModule);
//# sourceMappingURL=clients.module.js.map