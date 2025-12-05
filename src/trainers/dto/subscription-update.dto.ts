import { IsEnum, IsDateString, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

export class SubscriptionUpdateDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus, example: SubscriptionStatus.ACTIVE, description: 'Subscription status' })
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  subscriptionStatus?: SubscriptionStatus;

  @ApiPropertyOptional({ example: 'PREMIUM', description: 'Subscription tier' })
  @IsString()
  @IsOptional()
  subscriptionTier?: string;

  @ApiPropertyOptional({ example: '2025-12-31T00:00:00.000Z', description: 'Subscription expiration date' })
  @IsDateString()
  @IsOptional()
  subscriptionExpiresAt?: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z', description: 'Last payment date' })
  @IsDateString()
  @IsOptional()
  lastPaymentDate?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the subscription is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

