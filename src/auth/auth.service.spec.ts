import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TrainersService } from '../trainers/trainers.service';
import { ClientsService } from '../clients/clients.service';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let trainersService: jest.Mocked<TrainersService>;
  let clientsService: jest.Mocked<ClientsService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: Partial<UserDocument> = {
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    passwordHash: 'hashedPassword',
    role: UserRole.TRAINER,
    firstName: 'John',
    lastName: 'Doe',
    toObject: jest.fn().mockReturnValue({
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      role: UserRole.TRAINER,
      firstName: 'John',
      lastName: 'Doe',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findOneByEmail: jest.fn(),
            create: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: TrainersService,
          useValue: {
            createProfile: jest.fn(),
          },
        },
        {
          provide: ClientsService,
          useValue: {
            createProfile: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    trainersService = module.get(TrainersService);
    clientsService = module.get(ClientsService);
    jwtService = module.get(JwtService);

    // Mock bcrypt
    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      role: UserRole.TRAINER,
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should successfully register a new trainer user', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as User);
      trainersService.createProfile.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('token');

      const result = await service.register(registerDto);

      expect(usersService.findOneByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(bcrypt.genSalt).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 'salt');
      expect(usersService.create).toHaveBeenCalledWith({
        ...registerDto,
        password: 'hashedPassword',
      });
      expect(trainersService.createProfile).toHaveBeenCalledWith(
        mockUser._id.toString(),
        {},
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should successfully register a new client user with trainerId', async () => {
      const clientDto: RegisterDto = {
        ...registerDto,
        role: UserRole.CLIENT,
        trainerId: '507f1f77bcf86cd799439012',
      };
      const clientUser = { ...mockUser, role: UserRole.CLIENT };

      usersService.findOneByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(clientUser as User);
      clientsService.createProfile.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('token');

      const result = await service.register(clientDto);

      expect(usersService.findOneByEmail).toHaveBeenCalledWith(clientDto.email);
      expect(clientsService.createProfile).toHaveBeenCalledWith(
        clientUser._id.toString(),
        clientDto.trainerId,
        {},
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should throw ConflictException if user already exists', async () => {
      usersService.findOneByEmail.mockResolvedValue(mockUser as User);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('should return user object without passwordHash for valid credentials', async () => {
      usersService.findOneByEmail.mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(usersService.findOneByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('should return null for invalid email', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);

      const result = await service.validateUser('wrong@example.com', 'password123');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null for invalid password', async () => {
      usersService.findOneByEmail.mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(bcrypt.compare).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should generate tokens for user', async () => {
      jwtService.sign.mockReturnValue('token');
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';
      process.env.JWT_REFRESH_SECRET = 'refresh-secret';

      const result = await service.login(mockUser);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('accessToken', 'token');
      expect(result).toHaveProperty('refreshToken', 'token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id', mockUser._id);
      expect(result.user).toHaveProperty('email', mockUser.email);
      expect(result.user).toHaveProperty('role', mockUser.role);
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';
    const payload = {
      sub: mockUser._id.toString(),
      email: mockUser.email,
      role: mockUser.role,
    };

    beforeEach(() => {
      process.env.JWT_REFRESH_SECRET = 'refresh-secret';
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    });

    it('should generate new tokens for valid refresh token', async () => {
      jwtService.verify.mockReturnValue(payload);
      usersService.findOne.mockResolvedValue(mockUser as User);
      jwtService.sign.mockReturnValue('new-token');

      const result = await service.refreshToken(refreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'refresh-secret',
      });
      expect(usersService.findOne).toHaveBeenCalledWith(payload.sub);
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('accessToken', 'new-token');
      expect(result).toHaveProperty('refreshToken', 'new-token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jwtService.verify.mockReturnValue(payload);
      usersService.findOne.mockResolvedValue(null);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findOne).toHaveBeenCalledWith(payload.sub);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('generateTokens', () => {
    it('should generate tokens with correct payload structure', async () => {
      jwtService.sign.mockReturnValue('token');
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';
      process.env.JWT_REFRESH_SECRET = 'refresh-secret';

      const result = await service['generateTokens'](mockUser as UserDocument);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
        email: mockUser.email,
        sub: mockUser._id.toString(),
        role: mockUser.role,
      });
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        {
          email: mockUser.email,
          sub: mockUser._id.toString(),
          role: mockUser.role,
        },
        {
          secret: 'refresh-secret',
          expiresIn: '7d',
        },
      );
      expect(result).toHaveProperty('accessToken', 'token');
      expect(result).toHaveProperty('refreshToken', 'token');
      expect(result.user).toEqual({
        id: mockUser._id,
        email: mockUser.email,
        role: mockUser.role,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
      });
    });
  });
});

