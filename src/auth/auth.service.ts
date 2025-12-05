import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TrainersService } from '../trainers/trainers.service';
import { ClientsService } from '../clients/clients.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private trainersService: TrainersService,
    private clientsService: ClientsService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<any> {
    // Check if user exists
    const existingUser = await this.usersService.findOneByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    // Create user
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const userDoc = user as UserDocument;

    // Auto-create profile based on role
    if (userDoc.role === UserRole.TRAINER) {
      // Create TrainerProfile with default subscription (ACTIVE, expiresAt = +30 days)
      await this.trainersService.createProfile(userDoc._id.toString(), {});
    } else if (userDoc.role === UserRole.CLIENT) {
      // For CLIENT: trainerId can be provided in registerDto or assigned later
      // For now, we'll require trainerId in registerDto
      // TODO: Handle case where trainerId is not provided (can be assigned later)
      if ((registerDto as any).trainerId) {
        await this.clientsService.createProfile(
          userDoc._id.toString(),
          (registerDto as any).trainerId,
          {},
        );
      }
      // If no trainerId, client profile will be created later when assigned
    }

    return this.generateTokens(userDoc);
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email) as UserDocument;
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any) {
    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      }) as any;

      // Get user to ensure they still exist
      const user = await this.usersService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const newPayload: Record<string, any> = {
        email: user.email,
        sub: (user as any)._id.toString(),
        role: user.role,
      };

      const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
      return {
        accessToken: this.jwtService.sign(newPayload),
        refreshToken: this.jwtService.sign(newPayload, {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: refreshExpiresIn,
        } as any),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(user: UserDocument) {
    const payload: Record<string, any> = {
      email: user.email,
      sub: (user._id as any).toString(),
      role: user.role,
    };
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: refreshExpiresIn,
      } as any),
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
}
