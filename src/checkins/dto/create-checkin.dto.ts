import { IsDateString, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsNotEmpty()
  gpsCoordinates: GpsCoordinatesDto;

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

