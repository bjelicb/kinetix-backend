import { ApiProperty } from '@nestjs/swagger';

export class SyncChangesResponseDto {
  @ApiProperty({
    description: 'Updated workout logs since last sync',
    type: 'array',
    items: { type: 'object' },
  })
  workouts: any[];

  @ApiProperty({
    description: 'Updated weekly plans since last sync',
    type: 'array',
    items: { type: 'object' },
  })
  plans: any[];

  @ApiProperty({
    description: 'Updated check-ins since last sync',
    type: 'array',
    items: { type: 'object' },
  })
  checkIns: any[];

  @ApiProperty({
    description: 'Timestamp of this sync operation',
    type: 'string',
    format: 'date-time',
  })
  lastSync: Date;

  @ApiProperty({
    description: 'Total number of records returned',
    type: 'number',
  })
  totalRecords: number;
}

