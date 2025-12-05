import { Model } from 'mongoose';
import { PenaltyRecord, PenaltyRecordDocument } from './schemas/penalty-record.schema';
import { ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { PenaltyStatusDto } from './dto/penalty-status.dto';
export declare class GamificationService {
    private penaltyRecordModel;
    private clientProfileModel;
    private clientsService;
    private trainersService;
    constructor(penaltyRecordModel: Model<PenaltyRecordDocument>, clientProfileModel: Model<ClientProfileDocument>, clientsService: ClientsService, trainersService: TrainersService);
    getPenaltyStatus(clientId: string): Promise<PenaltyStatusDto>;
    getPenaltyHistory(clientId: string): Promise<PenaltyRecord[]>;
    resetPenalty(clientId: string, trainerUserId: string): Promise<void>;
    getLeaderboard(trainerUserId: string): Promise<any[]>;
}
