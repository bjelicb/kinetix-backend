"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckInsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const checkins_service_1 = require("./checkins.service");
const checkins_controller_1 = require("./checkins.controller");
const checkin_schema_1 = require("./schemas/checkin.schema");
const common_module_1 = require("../common/common.module");
const clients_module_1 = require("../clients/clients.module");
const trainers_module_1 = require("../trainers/trainers.module");
let CheckInsModule = class CheckInsModule {
};
exports.CheckInsModule = CheckInsModule;
exports.CheckInsModule = CheckInsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: checkin_schema_1.CheckIn.name, schema: checkin_schema_1.CheckInSchema }]),
            common_module_1.CommonModule,
            clients_module_1.ClientsModule,
            trainers_module_1.TrainersModule,
        ],
        controllers: [checkins_controller_1.CheckInsController],
        providers: [checkins_service_1.CheckInsService],
        exports: [checkins_service_1.CheckInsService],
    })
], CheckInsModule);
//# sourceMappingURL=checkins.module.js.map