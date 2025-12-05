import { UsersService } from '../users/users.service';
import { TrainersService } from '../trainers/trainers.service';
import { ClientsService } from '../clients/clients.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private usersService;
    private trainersService;
    private clientsService;
    private jwtService;
    constructor(usersService: UsersService, trainersService: TrainersService, clientsService: ClientsService, jwtService: JwtService);
    register(registerDto: RegisterDto): Promise<any>;
    validateUser(email: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: import("mongoose").Types.ObjectId;
            email: string;
            role: string;
            firstName: string;
            lastName: string;
        };
    }>;
    refreshToken(refreshToken: string): Promise<any>;
    private generateTokens;
}
