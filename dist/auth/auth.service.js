"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("../users/users.service");
const trainers_service_1 = require("../trainers/trainers.service");
const clients_service_1 = require("../clients/clients.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const user_role_enum_1 = require("../common/enums/user-role.enum");
let AuthService = class AuthService {
    usersService;
    trainersService;
    clientsService;
    jwtService;
    constructor(usersService, trainersService, clientsService, jwtService) {
        this.usersService = usersService;
        this.trainersService = trainersService;
        this.clientsService = clientsService;
        this.jwtService = jwtService;
    }
    async register(registerDto) {
        const existingUser = await this.usersService.findOneByEmail(registerDto.email);
        if (existingUser) {
            throw new common_1.ConflictException('User already exists');
        }
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(registerDto.password, salt);
        const user = await this.usersService.create({
            ...registerDto,
            password: hashedPassword,
        });
        const userDoc = user;
        if (userDoc.role === user_role_enum_1.UserRole.TRAINER) {
            await this.trainersService.createProfile(userDoc._id.toString(), {});
        }
        else if (userDoc.role === user_role_enum_1.UserRole.CLIENT) {
            if (registerDto.trainerId) {
                await this.clientsService.createProfile(userDoc._id.toString(), registerDto.trainerId, {});
            }
        }
        return this.generateTokens(userDoc);
    }
    async validateUser(email, pass) {
        const user = await this.usersService.findOneByEmail(email);
        if (user && (await bcrypt.compare(pass, user.passwordHash))) {
            const { passwordHash, ...result } = user.toObject();
            return result;
        }
        return null;
    }
    async login(user) {
        return this.generateTokens(user);
    }
    async refreshToken(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET,
            });
            const user = await this.usersService.findOne(payload.sub);
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            const newPayload = {
                email: user.email,
                sub: user._id.toString(),
                role: user.role,
            };
            const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
            return {
                accessToken: this.jwtService.sign(newPayload),
                refreshToken: this.jwtService.sign(newPayload, {
                    secret: process.env.JWT_REFRESH_SECRET,
                    expiresIn: refreshExpiresIn,
                }),
            };
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async generateTokens(user) {
        const payload = {
            email: user.email,
            sub: user._id.toString(),
            role: user.role,
        };
        const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        return {
            accessToken: this.jwtService.sign(payload),
            refreshToken: this.jwtService.sign(payload, {
                secret: process.env.JWT_REFRESH_SECRET,
                expiresIn: refreshExpiresIn,
            }),
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
            },
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        trainers_service_1.TrainersService,
        clients_service_1.ClientsService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map