import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VerificationStatus } from '../../common/enums/verification-status.enum';

export class VerifyCheckInDto {
  @IsEnum(VerificationStatus)
  @IsNotEmpty()
  verificationStatus: VerificationStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

