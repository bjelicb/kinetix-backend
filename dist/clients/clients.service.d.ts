import { Model, Types } from 'mongoose';
import { ClientProfile, ClientProfileDocument } from './schemas/client-profile.schema';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PlansService } from '../plans/plans.service';
export declare class ClientsService {
    private clientModel;
    private plansService;
    constructor(clientModel: Model<ClientProfileDocument>, plansService: PlansService);
    createProfile(userId: string, trainerId: string, dto: CreateClientDto): Promise<ClientProfile>;
    getProfile(userId: string): Promise<ClientProfile>;
    getProfileById(profileId: string | Types.ObjectId): Promise<ClientProfile>;
    updateProfile(userId: string, dto: UpdateClientDto): Promise<ClientProfile>;
    getCurrentPlan(userId: string): Promise<any>;
    getStats(userId: string): Promise<any>;
}
