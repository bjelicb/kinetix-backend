import { TrainersService } from './trainers.service';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { SubscriptionUpdateDto } from './dto/subscription-update.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class TrainersController {
    private trainersService;
    constructor(trainersService: TrainersService);
    getProfile(user: JwtPayload): Promise<import("./schemas/trainer-profile.schema").TrainerProfile>;
    updateProfile(user: JwtPayload, dto: UpdateTrainerDto): Promise<import("./schemas/trainer-profile.schema").TrainerProfile>;
    getClients(user: JwtPayload): Promise<any[]>;
    getSubscription(user: JwtPayload): Promise<{
        subscriptionStatus: import("../common/enums/subscription-status.enum").SubscriptionStatus;
        subscriptionTier: string;
        subscriptionExpiresAt: Date;
        lastPaymentDate: Date | undefined;
        isActive: boolean;
    }>;
    updateSubscription(user: JwtPayload, dto: SubscriptionUpdateDto): Promise<import("./schemas/trainer-profile.schema").TrainerProfile>;
    assignClient(user: JwtPayload, clientProfileId: string): Promise<{
        message: string;
        clientId: string;
    }>;
    removeClient(user: JwtPayload, clientProfileId: string): Promise<{
        message: string;
        clientId: string;
    }>;
    upgradeSubscription(user: JwtPayload, dto: UpgradeSubscriptionDto): Promise<import("./schemas/trainer-profile.schema").TrainerProfile>;
}
