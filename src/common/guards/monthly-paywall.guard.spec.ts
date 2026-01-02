import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MonthlyPaywallGuard } from './monthly-paywall.guard';
import { ClientsService } from '../../clients/clients.service';
import { GamificationService } from '../../gamification/gamification.service';
import { Types } from 'mongoose';

describe('MonthlyPaywallGuard', () => {
  let guard: MonthlyPaywallGuard;
  let clientsService: jest.Mocked<ClientsService>;
  let gamificationService: jest.Mocked<GamificationService>;
  let reflector: Reflector;

  const mockExecutionContext = (
    user: any,
    route: string = '/api/test',
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          route: { path: route },
          url: route,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonthlyPaywallGuard,
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
        {
          provide: GamificationService,
          useValue: {
            checkMonthlyPaywall: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {},
        },
      ],
    }).compile();

    guard = module.get<MonthlyPaywallGuard>(MonthlyPaywallGuard);
    clientsService = module.get(ClientsService);
    gamificationService = module.get(GamificationService);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow access if user is not CLIENT role', async () => {
      // TRAINER role
      const context = mockExecutionContext({ role: 'TRAINER', sub: 'trainer123' });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(clientsService.getProfile).not.toHaveBeenCalled();
      expect(gamificationService.checkMonthlyPaywall).not.toHaveBeenCalled();
    });

    it('should allow access if user is ADMIN role', async () => {
      const context = mockExecutionContext({ role: 'ADMIN', sub: 'admin123' });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(clientsService.getProfile).not.toHaveBeenCalled();
      expect(gamificationService.checkMonthlyPaywall).not.toHaveBeenCalled();
    });

    it('should allow access if user is missing', async () => {
      const context = mockExecutionContext(null);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(clientsService.getProfile).not.toHaveBeenCalled();
      expect(gamificationService.checkMonthlyPaywall).not.toHaveBeenCalled();
    });

    it('should block access if new month and balance > 0', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: new Date('2024-12-15T00:00:00.000Z'), // Last month
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(false); // New month and balance > 0

      const context = mockExecutionContext({ role: 'CLIENT', sub: 'client123' }, '/api/workouts');

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      expect(clientsService.getProfile).toHaveBeenCalledWith('client123');
      expect(gamificationService.checkMonthlyPaywall).toHaveBeenCalledWith(clientProfileId);
    });

    it('should throw ForbiddenException with correct message if new month and balance > 0', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: new Date('2024-12-15T00:00:00.000Z'),
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(false);

      const context = mockExecutionContext({ role: 'CLIENT', sub: 'client123' }, '/api/workouts');

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Your monthly balance must be cleared before accessing the app. Please make a payment to continue.',
      );
    });

    it('should allow access if same month', async () => {
      const clientProfileId = new Types.ObjectId();
      const now = new Date();
      const mockClient = {
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: now, // Same month
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(true); // Same month, allow access

      const context = mockExecutionContext({ role: 'CLIENT', sub: 'client123' }, '/api/workouts');

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(clientsService.getProfile).toHaveBeenCalledWith('client123');
      expect(gamificationService.checkMonthlyPaywall).toHaveBeenCalledWith(clientProfileId);
    });

    it('should allow access if balance = 0', async () => {
      const clientProfileId = new Types.ObjectId();
      const lastMonth = new Date('2024-12-15T00:00:00.000Z');
      const mockClient = {
        _id: clientProfileId,
        balance: 0,
        monthlyBalance: 0,
        lastBalanceReset: lastMonth,
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(true); // Balance = 0, allow access

      const context = mockExecutionContext({ role: 'CLIENT', sub: 'client123' }, '/api/workouts');

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(clientsService.getProfile).toHaveBeenCalledWith('client123');
      expect(gamificationService.checkMonthlyPaywall).toHaveBeenCalledWith(clientProfileId);
    });

    it('should allow access to payment routes even with balance > 0', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: new Date('2024-12-15T00:00:00.000Z'),
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(false); // New month and balance > 0

      // Payment route
      const context = mockExecutionContext(
        { role: 'CLIENT', sub: 'client123' },
        '/api/payment',
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(clientsService.getProfile).toHaveBeenCalledWith('client123');
      expect(gamificationService.checkMonthlyPaywall).toHaveBeenCalledWith(clientProfileId);
    });

    it('should allow access to balance routes even with balance > 0', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: new Date('2024-12-15T00:00:00.000Z'),
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(false);

      // Balance route
      const context = mockExecutionContext(
        { role: 'CLIENT', sub: 'client123' },
        '/api/balance',
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access to payment-history route (edge case)', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: new Date('2024-12-15T00:00:00.000Z'),
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(false);

      const context = mockExecutionContext(
        { role: 'CLIENT', sub: 'client123' },
        '/api/payment-history',
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true); // includes('/payment') should match
    });

    it('should allow access to balance-check route (edge case)', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: new Date('2024-12-15T00:00:00.000Z'),
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(false);

      const context = mockExecutionContext(
        { role: 'CLIENT', sub: 'client123' },
        '/api/balance-check',
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true); // includes('/balance') should match
    });

    it('should fail gracefully on error (allow access)', async () => {
      // Mock getProfile to throw error
      clientsService.getProfile.mockRejectedValue(new Error('Database error'));

      const context = mockExecutionContext({ role: 'CLIENT', sub: 'client123' }, '/api/workouts');

      const result = await guard.canActivate(context);
      expect(result).toBe(true); // Should allow access on error (fail gracefully)
      expect(clientsService.getProfile).toHaveBeenCalledWith('client123');
    });

    it('should allow access if clientsService.getProfile throws NotFoundException', async () => {
      clientsService.getProfile.mockRejectedValue(new NotFoundException('Client not found'));

      const context = mockExecutionContext({ role: 'CLIENT', sub: 'client123' }, '/api/workouts');

      const result = await guard.canActivate(context);
      expect(result).toBe(true); // Should allow access on NotFoundException (fail gracefully)
    });

    it('should throw ForbiddenException if checkMonthlyPaywall returns false and route is not payment-related', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: new Date('2024-12-15T00:00:00.000Z'),
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(false);

      const context = mockExecutionContext(
        { role: 'CLIENT', sub: 'client123' },
        '/api/workouts',
      );

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should handle route.path missing (fallback to url)', async () => {
      const clientProfileId = new Types.ObjectId();
      const mockClient = {
        _id: clientProfileId,
        balance: 10,
        monthlyBalance: 5,
        lastBalanceReset: new Date('2024-12-15T00:00:00.000Z'),
      };

      clientsService.getProfile.mockResolvedValue(mockClient as any);
      gamificationService.checkMonthlyPaywall.mockResolvedValue(false);

      // Mock context without route.path
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: 'CLIENT', sub: 'client123' },
            route: undefined,
            url: '/api/payment',
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      const result = await guard.canActivate(context);
      expect(result).toBe(true); // Should use url as fallback and allow payment route
    });
  });
});
