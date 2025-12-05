import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Types } from 'mongoose';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
  };

  const mockUser = {
    id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'test@example.com',
    role: UserRole.TRAINER,
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
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

    it('should register a new user', async () => {
      authService.register.mockResolvedValue(mockTokens);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockTokens);
    });

    it('should throw error if registration fails', async () => {
      authService.register.mockRejectedValue(new Error('Registration failed'));

      await expect(controller.register(registerDto)).rejects.toThrow('Registration failed');
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user with valid credentials', async () => {
      authService.validateUser.mockResolvedValue(mockUser);
      authService.login.mockResolvedValue(mockTokens);

      const result = await controller.login(loginDto);

      expect(authService.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockTokens);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'refresh-token',
    };

    it('should refresh access token', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      authService.refreshToken.mockResolvedValue(newTokens);

      const result = await controller.refresh(refreshTokenDto);

      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      expect(result).toEqual(newTokens);
    });

    it('should throw error for invalid refresh token', async () => {
      authService.refreshToken.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

      await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    const mockJwtPayload: JwtPayload = {
      sub: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      role: UserRole.TRAINER,
      iat: 1234567890,
      exp: 1234567890,
    };

    it('should return user profile from JWT payload', () => {
      const result = controller.getProfile(mockJwtPayload);

      expect(result).toEqual({
        id: mockJwtPayload.sub,
        email: mockJwtPayload.email,
        role: mockJwtPayload.role,
      });
    });
  });

  describe('logout', () => {
    it('should return success message', () => {
      const result = controller.logout();

      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
