import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TrainersService } from '../../trainers/trainers.service';
export declare class SaasKillswitchGuard implements CanActivate {
    private clientsService;
    private trainersService;
    constructor(clientsService: ClientsService, trainersService: TrainersService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
