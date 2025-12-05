import { Model } from 'mongoose';
import { CheckIn, CheckInDocument } from './schemas/checkin.schema';
import { CreateCheckInDto } from './dto/create-checkin.dto';
import { VerifyCheckInDto } from './dto/verify-checkin.dto';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
export declare class CheckInsService {
    private checkInModel;
    private clientsService;
    private trainersService;
    constructor(checkInModel: Model<CheckInDocument>, clientsService: ClientsService, trainersService: TrainersService);
    createCheckIn(clientId: string, createCheckInDto: CreateCheckInDto): Promise<CheckIn>;
    getCheckInsByClient(clientId: string): Promise<CheckIn[]>;
    getCheckInById(checkInId: string): Promise<CheckIn>;
    verifyCheckIn(checkInId: string, trainerUserId: string, verifyCheckInDto: VerifyCheckInDto): Promise<CheckIn>;
    getPendingCheckIns(trainerId: string): Promise<CheckIn[]>;
    getCheckInsByDateRange(clientId: string, startDate: Date, endDate: Date): Promise<CheckIn[]>;
    deleteCheckIn(checkInId: string, clientId: string): Promise<void>;
}
