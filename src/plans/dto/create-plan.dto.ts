import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutDifficulty } from '../../common/enums/workout-difficulty.enum';
import { WorkoutDayDto } from './create-workout.dto';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(WorkoutDifficulty)
  @IsOptional()
  difficulty?: WorkoutDifficulty;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutDayDto)
  @IsOptional()
  workouts?: WorkoutDayDto[];

  @IsBoolean()
  @IsOptional()
  isTemplate?: boolean;

  @IsMongoId()
  @IsOptional()
  trainerId?: string; // Required for ADMIN, optional for TRAINER (uses current user)
}

