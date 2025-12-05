import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsMongoId, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'Current plan ID' })
  @IsMongoId()
  @IsOptional()
  currentPlanId?: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z', description: 'Plan start date' })
  @IsDateString()
  @IsOptional()
  planStartDate?: string;

  @ApiPropertyOptional({ example: '2025-01-08T00:00:00.000Z', description: 'Plan end date' })
  @IsDateString()
  @IsOptional()
  planEndDate?: string;
}

