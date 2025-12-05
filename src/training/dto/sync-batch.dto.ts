import { IsArray, IsBoolean, IsDateString, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class CompletedExerciseDto {
  @IsString()
  @IsNotEmpty()
  exerciseName: string;

  @IsOptional()
  @IsNumber()
  targetSets?: number;

  @IsOptional()
  @IsString()
  targetReps?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  actualSets?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  actualReps?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  weightUsed?: number[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  restSeconds?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class WorkoutLogDto {
  @IsDateString()
  @IsNotEmpty()
  workoutDate: string;

  @IsString()
  @IsNotEmpty()
  weeklyPlanId: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedExerciseDto)
  completedExercises?: CompletedExerciseDto[];

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  difficultyRating?: number;

  @IsOptional()
  @IsString()
  clientNotes?: string;
}

class GpsCoordinatesDto {
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}

class CheckInDto {
  @IsDateString()
  @IsNotEmpty()
  checkinDate: string;

  @IsString()
  @IsNotEmpty()
  photoUrl: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ValidateNested()
  @Type(() => GpsCoordinatesDto)
  @IsNotEmpty()
  gpsCoordinates: GpsCoordinatesDto;

  @IsOptional()
  @IsMongoId()
  workoutLogId?: string;

  @IsOptional()
  @IsString()
  clientNotes?: string;
}

export class SyncBatchDto {
  @IsDateString()
  @IsNotEmpty()
  syncedAt: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutLogDto)
  newLogs?: WorkoutLogDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckInDto)
  newCheckIns?: CheckInDto[];
}

