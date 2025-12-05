import { Model } from 'mongoose';
import { TrainerProfileDocument } from '../schemas/trainer-profile.schema';
export declare class SubscriptionChecker {
    private trainerModel;
    constructor(trainerModel: Model<TrainerProfileDocument>);
    checkAndSuspendExpiredSubscriptions(): Promise<void>;
}
