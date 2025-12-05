import { Model, Types } from 'mongoose';
import { TrainerProfile, TrainerProfileDocument } from './schemas/trainer-profile.schema';
import { ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { SubscriptionUpdateDto } from './dto/subscription-update.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
export declare class TrainersService {
    private trainerModel;
    private clientModel;
    constructor(trainerModel: Model<TrainerProfileDocument>, clientModel: Model<ClientProfileDocument>);
    createProfile(userId: string, dto: CreateTrainerDto): Promise<TrainerProfile>;
    getProfile(userId: string): Promise<TrainerProfile>;
    getProfileById(profileId: string | Types.ObjectId): Promise<TrainerProfile>;
    updateProfile(userId: string, dto: UpdateTrainerDto): Promise<TrainerProfile>;
    getClients(userId: string): Promise<any[]>;
    updateSubscription(userId: string, dto: SubscriptionUpdateDto): Promise<TrainerProfile>;
    assignClientToTrainer(userId: string, clientProfileId: string): Promise<{
        message: string;
        clientId: string;
    }>;
    removeClientFromTrainer(userId: string, clientProfileId: string): Promise<{
        message: string;
        clientId: string;
    }>;
    upgradeSubscription(userId: string, dto: UpgradeSubscriptionDto): Promise<TrainerProfile>;
}
