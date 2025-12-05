import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SubscriptionTier {
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export class UpgradeSubscriptionDto {
  @ApiProperty({ 
    description: 'New subscription tier',
    enum: SubscriptionTier,
    example: SubscriptionTier.PRO,
  })
  @IsEnum(SubscriptionTier)
  @IsNotEmpty()
  newTier: SubscriptionTier;
}
