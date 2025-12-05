import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CompletedExerciseDto {
  @IsString()
  @IsNotEmpty()
  exerciseName: string;

  @IsNumber()
  @IsNotEmpty()
  actualSets: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  actualReps: number[];

  @IsNumber()
  @IsOptional()
  weightUsed?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class LogWorkoutDto {
  @IsDateString()
  @IsNotEmpty()
  workoutDate: string; // ISO 8601

  @IsMongoId()
  @IsNotEmpty()
  weeklyPlanId: string;

  @IsInt()
  @Min(1)
  @Max(7)
  @IsNotEmpty()
  dayOfWeek: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedExerciseDto)
  @IsOptional()
  completedExercises?: CompletedExerciseDto[];

  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @IsDateString()
  @IsOptional()
  completedAt?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  difficultyRating?: number;

  @IsString()
  @IsOptional()
  clientNotes?: string;
}

