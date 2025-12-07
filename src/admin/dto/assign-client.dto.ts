import { IsMongoId, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class AssignClientDto {
  @ApiProperty({ description: 'Client user ID to assign to trainer' })
  @IsMongoId()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ 
    description: 'Trainer user ID to assign client to. If null or empty, client will be unassigned from trainer.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  @ValidateIf((o) => o.trainerId != null && o.trainerId !== '')
  @IsMongoId()
  trainerId?: string | null;
}
