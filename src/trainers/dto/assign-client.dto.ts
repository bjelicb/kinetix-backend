import { IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignClientDto {
  @ApiProperty({ description: 'Client profile ID to assign to trainer' })
  @IsMongoId()
  @IsNotEmpty()
  clientId: string;
}
