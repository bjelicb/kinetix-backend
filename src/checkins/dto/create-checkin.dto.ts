import { IsDateString, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class GpsCoordinatesDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  accuracy?: number; // in meters
}

export class CreateCheckInDto {
  @IsMongoId()
  @IsOptional()
  workoutLogId?: string;

  @IsDateString()
  @IsNotEmpty()
  checkinDate: string;

  @IsString()
  @IsNotEmpty()
  photoUrl: string; // Cloudinary URL

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ValidateNested()
  @Type(() => GpsCoordinatesDto)
  @IsOptional()
  gpsCoordinates?: GpsCoordinatesDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidenceScore?: number;

  @IsOptional()
  @IsString({ each: true })
  detectedActivities?: string[];

  @IsOptional()
  @IsString()
  clientNotes?: string;
}

