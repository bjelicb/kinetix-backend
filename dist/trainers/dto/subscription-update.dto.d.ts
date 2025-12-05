import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
export declare class SubscriptionUpdateDto {
    subscriptionStatus?: SubscriptionStatus;
    subscriptionTier?: string;
    subscriptionExpiresAt?: string;
    lastPaymentDate?: string;
    isActive?: boolean;
}
