import { CheckInsService } from './checkins.service';
import { CreateCheckInDto } from './dto/create-checkin.dto';
import { VerifyCheckInDto } from './dto/verify-checkin.dto';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class CheckInsController {
    private readonly checkInsService;
    constructor(checkInsService: CheckInsService);
    createCheckIn(user: JwtPayload, createCheckInDto: CreateCheckInDto): Promise<import("./schemas/checkin.schema").CheckIn>;
    getCheckInsByClient(user: JwtPayload): Promise<import("./schemas/checkin.schema").CheckIn[]>;
    getPendingCheckIns(trainerId: string): Promise<import("./schemas/checkin.schema").CheckIn[]>;
    getCheckInById(id: string): Promise<import("./schemas/checkin.schema").CheckIn>;
    verifyCheckIn(id: string, user: JwtPayload, verifyCheckInDto: VerifyCheckInDto): Promise<import("./schemas/checkin.schema").CheckIn>;
    getCheckInsByDateRange(user: JwtPayload, startDate: string, endDate: string): Promise<import("./schemas/checkin.schema").CheckIn[]>;
    deleteCheckIn(user: JwtPayload, checkInId: string): Promise<{
        message: string;
    }>;
}
