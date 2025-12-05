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
exports.CreateClientDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const client_profile_schema_1 = require("../schemas/client-profile.schema");
class CreateClientDto {
    trainerId;
    age;
    weight;
    height;
    fitnessGoal;
    activityLevel;
    medicalConditions;
    notes;
}
exports.CreateClientDto = CreateClientDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '507f1f77bcf86cd799439011', description: 'Trainer ID' }),
    (0, class_validator_1.IsMongoId)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateClientDto.prototype, "trainerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 30, description: 'Client age' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateClientDto.prototype, "age", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 75.5, description: 'Client weight in kg' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateClientDto.prototype, "weight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 175, description: 'Client height in cm' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateClientDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_profile_schema_1.FitnessGoal, example: client_profile_schema_1.FitnessGoal.WEIGHT_LOSS, description: 'Fitness goal' }),
    (0, class_validator_1.IsEnum)(client_profile_schema_1.FitnessGoal),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateClientDto.prototype, "fitnessGoal", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_profile_schema_1.ActivityLevel, example: client_profile_schema_1.ActivityLevel.MODERATE, description: 'Activity level' }),
    (0, class_validator_1.IsEnum)(client_profile_schema_1.ActivityLevel),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateClientDto.prototype, "activityLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'No known medical conditions', description: 'Medical conditions' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateClientDto.prototype, "medicalConditions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Prefers morning workouts', description: 'Additional notes' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateClientDto.prototype, "notes", void 0);
//# sourceMappingURL=create-client.dto.js.map