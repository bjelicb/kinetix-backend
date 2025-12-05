"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonModule = void 0;
const common_1 = require("@nestjs/common");
const saas_killswitch_guard_1 = require("./guards/saas-killswitch.guard");
const clients_module_1 = require("../clients/clients.module");
const trainers_module_1 = require("../trainers/trainers.module");
let CommonModule = class CommonModule {
};
exports.CommonModule = CommonModule;
exports.CommonModule = CommonModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => clients_module_1.ClientsModule),
            (0, common_1.forwardRef)(() => trainers_module_1.TrainersModule),
        ],
        providers: [saas_killswitch_guard_1.SaasKillswitchGuard],
        exports: [saas_killswitch_guard_1.SaasKillswitchGuard],
    })
], CommonModule);
//# sourceMappingURL=common.module.js.map