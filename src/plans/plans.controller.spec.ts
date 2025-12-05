import { Test, TestingModule } from '@nestjs/testing';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
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

      const result = await controller.getPlanById(planId);

      expect(plansService.getPlanById).toHaveBeenCalledWith(planId);
      expect(result).toEqual(mockPlan);
    });

    it('should throw NotFoundException if plan not found', async () => {
      plansService.getPlanById.mockRejectedValue(new NotFoundException('Plan not found'));

      await expect(controller.getPlanById(planId)).rejects.toThrow(NotFoundException);
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

      expect(plansService.updatePlan).toHaveBeenCalledWith(planId, mockJwtPayload.sub, updateDto);
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

      expect(plansService.deletePlan).toHaveBeenCalledWith(planId, mockJwtPayload.sub);
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

      expect(plansService.duplicatePlan).toHaveBeenCalledWith(planId, mockJwtPayload.sub);
      expect(result).toEqual(duplicatedPlan);
    });

    it('should throw ForbiddenException if trainer does not own plan', async () => {
      plansService.duplicatePlan.mockRejectedValue(
        new ForbiddenException('You do not have permission to duplicate this plan'),
      );

      await expect(controller.duplicatePlan(mockJwtPayload, planId)).rejects.toThrow(ForbiddenException);
    });
  });
});
