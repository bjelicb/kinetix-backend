import { Test, TestingModule } from '@nestjs/testing';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Types } from 'mongoose';

describe('PlansController', () => {
  let controller: PlansController;
  let plansService: jest.Mocked<PlansService>;

  const mockPlansService = {
    createPlan: jest.fn(),
    getPlans: jest.fn(),
    getPlanById: jest.fn(),
    updatePlan: jest.fn(),
    deletePlan: jest.fn(),
    assignPlanToClients: jest.fn(),
    duplicatePlan: jest.fn(),
    cancelPlan: jest.fn(),
    canUnlockNextWeek: jest.fn(),
    requestNextWeek: jest.fn(),
    clientsService: {
      getProfile: jest.fn(),
    },
  };

  const mockPlan = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439030'),
    trainerId: new Types.ObjectId('507f1f77bcf86cd799439020'),
    name: 'Test Plan',
    description: 'Test Description',
    difficulty: 'BEGINNER',
    workouts: [],
    isTemplate: true,
  };

  const mockJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439011',
    email: 'trainer@test.com',
    role: 'TRAINER',
    iat: 1234567890,
    exp: 1234567890,
  };

  beforeEach(async () => {
    // Inject clientsService into plansService mock
    (mockPlansService as any)['clientsService'] = {
      getProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        {
          provide: PlansService,
          useValue: mockPlansService,
        },
      ],
    }).compile();

    controller = module.get<PlansController>(PlansController);
    plansService = module.get(PlansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPlan', () => {
    const createDto: CreatePlanDto = {
      name: 'New Plan',
      description: 'Plan Description',
      difficulty: 'BEGINNER',
      workouts: [],
      isTemplate: true,
    };

    it('should create a new plan', async () => {
      const createdPlan = { ...mockPlan, ...createDto };
      plansService.createPlan.mockResolvedValue(createdPlan as any);

      const result = await controller.createPlan(mockJwtPayload, createDto);

      expect(plansService.createPlan).toHaveBeenCalledWith(mockJwtPayload.sub, createDto);
      expect(result).toEqual(createdPlan);
    });
  });

  describe('getPlans', () => {
    it('should return all plans for trainer', async () => {
      const plans = [mockPlan];
      plansService.getPlans.mockResolvedValue(plans as any);

      const result = await controller.getPlans(mockJwtPayload);

      expect(plansService.getPlans).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result).toEqual(plans);
    });
  });

  describe('getPlanById', () => {
    const planId = '507f1f77bcf86cd799439030';

    it('should return plan by id', async () => {
      plansService.getPlanById.mockResolvedValue(mockPlan as any);

      const result = await controller.getPlanById(planId, mockJwtPayload);

      expect(plansService.getPlanById).toHaveBeenCalledWith(planId, mockJwtPayload.sub, mockJwtPayload.role);
      expect(result).toEqual(mockPlan);
    });

    it('should throw NotFoundException if plan not found', async () => {
      plansService.getPlanById.mockRejectedValue(new NotFoundException('Plan not found'));

      await expect(controller.getPlanById(planId, mockJwtPayload)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if plan does not belong to trainer', async () => {
      plansService.getPlanById.mockRejectedValue(new ForbiddenException('You can only access your own plans'));

      await expect(controller.getPlanById(planId, mockJwtPayload)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updatePlan', () => {
    const planId = '507f1f77bcf86cd799439030';
    const updateDto: UpdatePlanDto = {
      name: 'Updated Plan',
    };

    it('should update plan', async () => {
      const updatedPlan = { ...mockPlan, ...updateDto };
      plansService.updatePlan.mockResolvedValue(updatedPlan as any);

      const result = await controller.updatePlan(mockJwtPayload, planId, updateDto);

      expect(plansService.updatePlan).toHaveBeenCalledWith(planId, mockJwtPayload.sub, mockJwtPayload.role, updateDto);
      expect(result).toEqual(updatedPlan);
    });

    it('should throw ForbiddenException if trainer does not own plan', async () => {
      plansService.updatePlan.mockRejectedValue(
        new ForbiddenException('You do not have permission to update this plan'),
      );

      await expect(controller.updatePlan(mockJwtPayload, planId, updateDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deletePlan', () => {
    const planId = '507f1f77bcf86cd799439030';

    it('should delete plan', async () => {
      plansService.deletePlan.mockResolvedValue(undefined);

      await controller.deletePlan(mockJwtPayload, planId);

      expect(plansService.deletePlan).toHaveBeenCalledWith(planId, mockJwtPayload.sub, mockJwtPayload.role);
    });

    it('should throw ForbiddenException if trainer does not own plan', async () => {
      plansService.deletePlan.mockRejectedValue(
        new ForbiddenException('You do not have permission to delete this plan'),
      );

      await expect(controller.deletePlan(mockJwtPayload, planId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignPlan', () => {
    const planId = '507f1f77bcf86cd799439030';
    const assignDto: AssignPlanDto = {
      clientIds: ['507f1f77bcf86cd799439021'],
      startDate: new Date('2024-01-01').toISOString(),
    };

    it('should assign plan to clients', async () => {
      const result = {
        message: 'Plan assigned successfully',
        clientIds: assignDto.clientIds,
      };
      plansService.assignPlanToClients.mockResolvedValue(result);

      const response = await controller.assignPlan(mockJwtPayload, planId, assignDto);

      expect(plansService.assignPlanToClients).toHaveBeenCalledWith(
        planId,
        mockJwtPayload.sub,
        mockJwtPayload.role,
        assignDto,
      );
      expect(response).toEqual(result);
    });

    it('should throw ForbiddenException if trainer does not own plan', async () => {
      plansService.assignPlanToClients.mockRejectedValue(
        new ForbiddenException('You do not have permission to assign this plan'),
      );

      await expect(controller.assignPlan(mockJwtPayload, planId, assignDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('duplicatePlan', () => {
    const planId = '507f1f77bcf86cd799439030';

    it('should duplicate plan', async () => {
      const duplicatedPlan = {
        ...mockPlan,
        name: 'Test Plan (Copy)',
        assignedClientIds: [],
      };
      plansService.duplicatePlan.mockResolvedValue(duplicatedPlan as any);

      const result = await controller.duplicatePlan(mockJwtPayload, planId);

      expect(plansService.duplicatePlan).toHaveBeenCalledWith(planId, mockJwtPayload.sub, mockJwtPayload.role);
      expect(result).toEqual(duplicatedPlan);
    });

    it('should throw ForbiddenException if trainer does not own plan', async () => {
      plansService.duplicatePlan.mockRejectedValue(
        new ForbiddenException('You do not have permission to duplicate this plan'),
      );

      await expect(controller.duplicatePlan(mockJwtPayload, planId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancelPlan', () => {
    const planId = '507f1f77bcf86cd799439030';
    const clientId = '507f1f77bcf86cd799439021';

    it('should cancel plan for client', async () => {
      mockPlansService.cancelPlan.mockResolvedValue(undefined);

      const result = await controller.cancelPlan(mockJwtPayload, planId, clientId);

      expect(mockPlansService.cancelPlan).toHaveBeenCalledWith(
        planId,
        clientId,
        mockJwtPayload.sub,
        mockJwtPayload.role,
      );
      expect(result).toEqual({ message: 'Plan cancelled successfully' });
    });

    it('should throw NotFoundException if plan not found', async () => {
      mockPlansService.cancelPlan.mockRejectedValue(new NotFoundException('Plan not found'));

      await expect(controller.cancelPlan(mockJwtPayload, planId, clientId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if plan cannot be cancelled', async () => {
      mockPlansService.cancelPlan.mockRejectedValue(
        new BadRequestException('Cannot cancel - has active workout logs'),
      );

      await expect(controller.cancelPlan(mockJwtPayload, planId, clientId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('canUnlockNextWeek', () => {
    const clientId = '507f1f77bcf86cd799439021';

    it('should return canUnlock status for TRAINER role', async () => {
      mockPlansService.canUnlockNextWeek.mockResolvedValue(true);

      const result = await controller.canUnlockNextWeek(mockJwtPayload, clientId);

      expect(mockPlansService.canUnlockNextWeek).toHaveBeenCalledWith(clientId);
      expect(result).toEqual({ canUnlock: true });
    });

    it('should return canUnlock status for ADMIN role', async () => {
      const adminPayload: JwtPayload = {
        ...mockJwtPayload,
        role: 'ADMIN',
      };
      mockPlansService.canUnlockNextWeek.mockResolvedValue(false);

      const result = await controller.canUnlockNextWeek(adminPayload, clientId);

      expect(mockPlansService.canUnlockNextWeek).toHaveBeenCalledWith(clientId);
      expect(result).toEqual({ canUnlock: false });
    });

    it('should resolve clientProfileId for CLIENT role', async () => {
      const clientPayload: JwtPayload = {
        sub: '507f1f77bcf86cd799439012',
        email: 'client@test.com',
        role: 'CLIENT',
        iat: 1234567890,
        exp: 1234567890,
      };
      const clientProfileId = new Types.ObjectId().toString();
      const mockClient = {
        _id: new Types.ObjectId(clientProfileId),
        userId: new Types.ObjectId(clientPayload.sub),
      };

      (mockPlansService as any)['clientsService'].getProfile.mockResolvedValue(mockClient);
      mockPlansService.canUnlockNextWeek.mockResolvedValue(true);

      const result = await controller.canUnlockNextWeek(clientPayload, clientId);

      expect((mockPlansService as any)['clientsService'].getProfile).toHaveBeenCalledWith(
        clientPayload.sub,
      );
      expect(mockPlansService.canUnlockNextWeek).toHaveBeenCalledWith(clientProfileId);
      expect(result).toEqual({ canUnlock: true });
    });

    it('should use clientId param if getProfile fails for CLIENT role', async () => {
      const clientPayload: JwtPayload = {
        sub: '507f1f77bcf86cd799439012',
        email: 'client@test.com',
        role: 'CLIENT',
        iat: 1234567890,
        exp: 1234567890,
      };

      (mockPlansService as any)['clientsService'].getProfile.mockRejectedValue(
        new NotFoundException('Client not found'),
      );
      mockPlansService.canUnlockNextWeek.mockResolvedValue(true);

      const result = await controller.canUnlockNextWeek(clientPayload, clientId);

      expect(mockPlansService.canUnlockNextWeek).toHaveBeenCalledWith(clientId);
      expect(result).toEqual({ canUnlock: true });
    });
  });

  describe('requestNextWeek', () => {
    const clientId = new Types.ObjectId().toString();
    const clientPayload: JwtPayload = {
      sub: '507f1f77bcf86cd799439012',
      email: 'client@test.com',
      role: 'CLIENT',
      iat: 1234567890,
      exp: 1234567890,
    };

    it('should unlock next week and charge balance for CLIENT', async () => {
      const mockClient = {
        _id: new Types.ObjectId(clientId),
        userId: new Types.ObjectId(clientPayload.sub),
      };

      (mockPlansService as any)['clientsService'].getProfile.mockResolvedValue(mockClient);
      const mockResult = {
        currentPlanId: '507f1f77bcf86cd799439031',
        balance: 5.0,
        monthlyBalance: 3.0,
      };
      mockPlansService.requestNextWeek.mockResolvedValue(mockResult);

      const result = await controller.requestNextWeek(clientPayload, clientId);

      expect((mockPlansService as any)['clientsService'].getProfile).toHaveBeenCalledWith(
        clientPayload.sub,
      );
      expect(mockPlansService.requestNextWeek).toHaveBeenCalledWith(clientId);
      expect(result).toEqual({
        message: 'Next week request submitted successfully',
        currentPlanId: mockResult.currentPlanId,
        balance: mockResult.balance,
        monthlyBalance: mockResult.monthlyBalance,
      });
    });

    it('should throw BadRequestException if clientId param does not match authenticated user', async () => {
      const differentClientId = new Types.ObjectId().toString();
      const mockClient = {
        _id: new Types.ObjectId(differentClientId),
        userId: new Types.ObjectId(clientPayload.sub),
      };

      (mockPlansService as any)['clientsService'].getProfile.mockResolvedValue(mockClient);

      await expect(controller.requestNextWeek(clientPayload, clientId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPlansService.requestNextWeek).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if cannot unlock', async () => {
      const mockClient = {
        _id: new Types.ObjectId(clientId),
        userId: new Types.ObjectId(clientPayload.sub),
      };

      (mockPlansService as any)['clientsService'].getProfile.mockResolvedValue(mockClient);
      mockPlansService.requestNextWeek.mockRejectedValue(
        new BadRequestException('Cannot request next week. Current week must be completed first.'),
      );

      await expect(controller.requestNextWeek(clientPayload, clientId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPlansService.requestNextWeek).toHaveBeenCalledWith(clientId);
    });

    it('should throw NotFoundException if client profile not found', async () => {
      (mockPlansService as any)['clientsService'].getProfile.mockRejectedValue(
        new NotFoundException('Client profile not found'),
      );

      await expect(controller.requestNextWeek(clientPayload, clientId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPlansService.requestNextWeek).not.toHaveBeenCalled();
    });
  });
});
