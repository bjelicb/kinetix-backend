import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExerciseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  sets: number;

  @IsString()
  @IsNotEmpty()
  reps: string | number; // Can be "10-12" or number

  @IsNumber()
  @IsOptional()
  restSeconds?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  videoUrl?: string;
}

export class WorkoutDayDto {
  @IsInt()
  @Min(1)
  @Max(7)
  @IsNotEmpty()
  dayOfWeek: number; // 1-7

  @IsBoolean()
  @IsOptional()
  isRestDay?: boolean;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  @IsOptional()
  exercises?: ExerciseDto[];

  @IsNumber()
  @IsOptional()
  estimatedDuration?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

