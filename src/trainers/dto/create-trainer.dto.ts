import { IsOptional, IsString, IsArray, IsNumber, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTrainerDto {
  @ApiPropertyOptional({ example: 'FitZone Gym', description: 'Business name' })
  @IsString()
  @IsOptional()
  businessName?: string;

  @ApiPropertyOptional({ example: 'Certified personal trainer with 10 years of experience', description: 'Trainer bio', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: ['NASM-CPT', 'ACE-CPT'], description: 'List of certifications', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  certifications?: string[];

  @ApiPropertyOptional({ example: ['Weight Loss', 'Strength Training'], description: 'List of specializations', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specializations?: string[];

  @ApiPropertyOptional({ example: 10, description: 'Years of experience' })
  @IsNumber()
  @IsOptional()
  yearsExperience?: number;
}

