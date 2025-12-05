import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<any>;
    login(loginDto: LoginDto): Promise<{
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
    refresh(refreshTokenDto: RefreshTokenDto): Promise<any>;
    getProfile(user: JwtPayload): {
        id: string;
        email: string;
        role: string;
    };
    logout(): {
        message: string;
    };
}
