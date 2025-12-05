import { Model } from 'mongoose';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { CheckInsService } from '../checkins/checkins.service';
export interface SyncError {
    type: 'LOG' | 'CHECKIN';
    index: number;
    reason: string;
}
export interface SyncResult {
    processedLogs: number;
    processedCheckIns: number;
    errors: SyncError[];
}
export declare class TrainingService {
    private clientsService;
    private workoutsService;
    private checkInsService;
    private workoutLogModel;
    private checkInModel;
    constructor(clientsService: ClientsService, workoutsService: WorkoutsService, checkInsService: CheckInsService, workoutLogModel: Model<any>, checkInModel: Model<any>);
    syncBatch(clientId: string, syncBatchDto: SyncBatchDto): Promise<SyncResult>;
}
