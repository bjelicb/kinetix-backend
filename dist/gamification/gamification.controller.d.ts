import { GamificationService } from './gamification.service';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class GamificationController {
    private readonly gamificationService;
    constructor(gamificationService: GamificationService);
    getPenaltyStatus(user: JwtPayload): Promise<import("./dto/penalty-status.dto").PenaltyStatusDto>;
    getPenaltyHistory(user: JwtPayload): Promise<import("./schemas/penalty-record.schema").PenaltyRecord[]>;
    getLeaderboard(user: JwtPayload): Promise<any[]>;
    resetPenalty(clientId: string, user: JwtPayload): Promise<{
        message: string;
    }>;
}
