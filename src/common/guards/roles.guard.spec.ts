import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const mockExecutionContext = (user: any, handler: any = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => handler,
      getClass: () => ({}),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      const context = mockExecutionContext({ role: UserRole.CLIENT });
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access when user role matches required role', () => {
      const context = mockExecutionContext({ role: UserRole.TRAINER });
      reflector.getAllAndOverride.mockReturnValue([UserRole.TRAINER]);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny access when user role does not match required role', () => {
      const context = mockExecutionContext({ role: UserRole.CLIENT });
      reflector.getAllAndOverride.mockReturnValue([UserRole.TRAINER]);

      const result = guard.canActivate(context);
      expect(result).toBe(false);
    });

    it('should allow access when user role matches one of multiple required roles', () => {
      const context = mockExecutionContext({ role: UserRole.CLIENT });
      reflector.getAllAndOverride.mockReturnValue([UserRole.TRAINER, UserRole.CLIENT]);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny access when user is missing', () => {
      const context = mockExecutionContext(null);
      reflector.getAllAndOverride.mockReturnValue([UserRole.TRAINER]);

      const result = guard.canActivate(context);
      expect(result).toBe(false);
    });

    it('should deny access when user role is missing', () => {
      const context = mockExecutionContext({});
      reflector.getAllAndOverride.mockReturnValue([UserRole.TRAINER]);

      const result = guard.canActivate(context);
      expect(result).toBe(false);
    });
  });
});

