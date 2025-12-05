import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
} from 'class-validator';

export class AssignPlanDto {
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  clientIds: string[];

  @IsDateString()
  @IsNotEmpty()
  startDate: string; // ISO 8601 format
}

