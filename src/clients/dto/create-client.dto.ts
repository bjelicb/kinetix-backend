import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsMongoId,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  FitnessGoal,
  ActivityLevel,
} from '../schemas/client-profile.schema';


class MacroTargetsDto {
  @ApiPropertyOptional({ example: 2000 })
  @IsNumber()
  @IsOptional()
  calories?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsNumber()
  @IsOptional()
  protein?: number;

  @ApiPropertyOptional({ example: 250 })
  @IsNumber()
  @IsOptional()
  carbs?: number;

  @ApiPropertyOptional({ example: 70 })
  @IsNumber()
  @IsOptional()
  fats?: number;
}

export class CreateClientDto {
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'Trainer ID' })
  @IsMongoId()
  @IsOptional()
  trainerId?: string;

  @ApiPropertyOptional({ example: 30, description: 'Client age' })
  @IsNumber()
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({ example: 75.5, description: 'Client weight in kg' })
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ example: 175, description: 'Client height in cm' })
  @IsNumber()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({ enum: FitnessGoal, example: FitnessGoal.WEIGHT_LOSS, description: 'Fitness goal' })
  @IsEnum(FitnessGoal)
  @IsOptional()
  fitnessGoal?: FitnessGoal;

  @ApiPropertyOptional({ enum: ActivityLevel, example: ActivityLevel.MODERATE, description: 'Activity level' })
  @IsEnum(ActivityLevel)
  @IsOptional()
  activityLevel?: ActivityLevel;

  @ApiPropertyOptional({ type: MacroTargetsDto, description: 'Nutritional targets' })
  @ValidateNested()
  @Type(() => MacroTargetsDto)
  @IsOptional()
  macroTargets?: MacroTargetsDto;

  @ApiPropertyOptional({ example: 'No known medical conditions', description: 'Medical conditions' })
  @IsString()
  @IsOptional()
  medicalConditions?: string;

  @ApiPropertyOptional({ example: 'Prefers morning workouts', description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

