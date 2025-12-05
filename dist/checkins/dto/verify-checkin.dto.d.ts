import { VerificationStatus } from '../../common/enums/verification-status.enum';
export declare class VerifyCheckInDto {
    verificationStatus: VerificationStatus;
    rejectionReason?: string;
}
