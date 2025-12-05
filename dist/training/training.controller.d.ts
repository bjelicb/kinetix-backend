import { TrainingService } from './training.service';
import { SyncBatchDto } from './dto/sync-batch.dto';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class TrainingController {
    private readonly trainingService;
    constructor(trainingService: TrainingService);
    syncBatch(user: JwtPayload, syncBatchDto: SyncBatchDto): Promise<import("./training.service").SyncResult>;
}
