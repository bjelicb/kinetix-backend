import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { PlansService } from './plans.service';
import { WeeklyPlan, WeeklyPlanDocument } from './schemas/weekly-plan.schema';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { TrainersService } from '../trainers/trainers.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

describe('PlansService', () => {
  let service: PlansService;
  let planModel: jest.Mocked<Model<WeeklyPlanDocument>>;
  let clientsService: jest.Mocked<ClientsService>;
  let workoutsService: jest.Mocked<WorkoutsService>;
  let trainersService: jest.Mocked<TrainersService>;

  const mockTrainerId = '507f1f77bcf86cd799439011';
  const mockPlanId = '507f1f77bcf86cd799439012';
  const mockClientId = '507f1f77bcf86cd799439013';
  const mockTrainerProfileId = '507f1f77bcf86cd799439020';
  
  const mockTrainerProfile = {
    _id: new Types.ObjectId(mockTrainerProfileId),
    userId: new Types.ObjectId(mockTrainerId),
  };

  const mockPlan: Partial<WeeklyPlanDocument> = {
    _id: new Types.ObjectId(mockPlanId),
    trainerId: new Types.ObjectId(mockTrainerProfileId),
    name: 'Test Plan',
    description: 'Test Description',
    difficulty: 'INTERMEDIATE',
    workouts: [
      {
        dayOfWeek: 1,
        name: 'Monday Workout',
        exercises: [
          { name: 'Squat', sets: 3, reps: [10, 10, 10], weight: 100 },
        ],
      },
    ],
    isTemplate: true,
    assignedClientIds: [],
    save: jest.fn().mockResolvedValue(this),
  };

  const mockClientProfile = {
    _id: new Types.ObjectId(mockClientId),
    userId: new Types.ObjectId('507f1f77bcf86cd799439014'),
    trainerId: new Types.ObjectId(mockTrainerProfileId),
  };

  beforeEach(async () => {
    const mockModelConstructor = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, ...mockPlan }),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: getModelToken(WeeklyPlan.name),
          useValue: mockModelConstructor,
        },
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
            getProfileById: jest.fn(),
            updateProfile: jest.fn(),
          },
        },
        {
          provide: WorkoutsService,
          useValue: {
            generateWeeklyLogs: jest.fn(),
          },
        },
        {
          provide: TrainersService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    planModel = module.get(getModelToken(WeeklyPlan.name));
    clientsService = module.get(ClientsService);
    workoutsService = module.get(WorkoutsService);
    trainersService = module.get(TrainersService);

    // Add methods to mockModelConstructor
    (planModel as any).find = jest.fn();
    (planModel as any).findById = jest.fn();
    (planModel as any).findByIdAndUpdate = jest.fn();
    (planModel as any).findByIdAndDelete = jest.fn();
    
    // Default mock for trainersService.getProfile
    trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Re-setup default mock for trainersService.getProfile after clearing
    trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
  });

  describe('createPlan', () => {
    it('should create a new plan', async () => {
      const createDto: CreatePlanDto = {
        name: 'New Plan',
        description: 'Plan Description',
        difficulty: 'BEGINNER',
        workouts: [],
        isTemplate: true,
      };

      const savedPlan = { ...mockPlan, ...createDto };
      const mockInstance = {
        ...createDto,
        save: jest.fn().mockResolvedValue(savedPlan),
      };
      (planModel as any).mockImplementation(() => mockInstance);

      const result = await service.createPlan(mockTrainerId, createDto);

      expect(planModel).toHaveBeenCalled();
      expect(mockInstance.save).toHaveBeenCalled();
      expect(result).toMatchObject(createDto);
    });
  });

  describe('getPlans', () => {
    it('should return all plans for a trainer', async () => {
      const plans = [mockPlan];
      (planModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(plans),
            }),
          }),
        }),
      });

      const result = await service.getPlans(mockTrainerId);

      expect((planModel as any).find).toHaveBeenCalledWith({
        trainerId: new Types.ObjectId(mockTrainerProfileId),
      });
      expect(result).toEqual(plans);
    });
  });

  describe('getPlanById', () => {
    it('should return a plan by id', async () => {
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockPlan),
          }),
        }),
      });

      const result = await service.getPlanById(mockPlanId);

      expect((planModel as any).findById).toHaveBeenCalledWith(mockPlanId);
      expect(result).toEqual(mockPlan);
    });

    it('should throw NotFoundException if plan not found', async () => {
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(service.getPlanById(mockPlanId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePlan', () => {
    it('should update a plan', async () => {
      const updateDto: UpdatePlanDto = {
        name: 'Updated Plan',
      };

      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockPlan),
          }),
        }),
      });

      const updatedPlan = { ...mockPlan, ...updateDto };
      (planModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedPlan),
      });

      const result = await service.updatePlan(mockPlanId, mockTrainerId, updateDto);

      expect((planModel as any).findByIdAndUpdate).toHaveBeenCalledWith(
        mockPlanId,
        { $set: updateDto },
        { new: true },
      );
      expect(result).toEqual(updatedPlan);
    });

    it('should throw ForbiddenException if trainer does not own plan', async () => {
      const otherTrainerProfileId = '507f1f77bcf86cd799439021';
      const otherPlan = { ...mockPlan, trainerId: new Types.ObjectId(otherTrainerProfileId) };

      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(otherPlan),
          }),
        }),
      });

      await expect(
        service.updatePlan(mockPlanId, mockTrainerId, { name: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePlan', () => {
    it('should delete a plan', async () => {
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockPlan),
          }),
        }),
      });

      (planModel as any).findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });

      await service.deletePlan(mockPlanId, mockTrainerId);

      expect((planModel as any).findByIdAndDelete).toHaveBeenCalledWith(mockPlanId);
    });
  });

  describe('assignPlanToClients', () => {
    it('should assign plan to clients and generate workout logs', async () => {
      const assignDto: AssignPlanDto = {
        clientIds: [mockClientId],
        startDate: new Date('2024-01-01').toISOString(),
      };

      // First findById call (for ownership check)
      (planModel as any).findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockPlan),
          }),
        }),
      });
      // Second findById call (for planForLogs)
      (planModel as any).findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });

      (planModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });

      clientsService.getProfileById.mockResolvedValue(mockClientProfile as any);
      clientsService.updateProfile.mockResolvedValue(mockClientProfile as any);
      workoutsService.generateWeeklyLogs.mockResolvedValue([]);

      const result = await service.assignPlanToClients(
        mockPlanId,
        mockTrainerId,
        assignDto,
      );

      expect(clientsService.updateProfile).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439014', // clientUserId (extracted from client.userId)
        {
          currentPlanId: mockPlanId,
          planStartDate: expect.any(String),
          planEndDate: expect.any(String),
        },
      );
      expect(clientsService.getProfileById).toHaveBeenCalledWith(mockClientId);
      expect(workoutsService.generateWeeklyLogs).toHaveBeenCalledWith(
        mockClientProfile,
        mockPlan,
        expect.any(Date),
      );
      expect(result.message).toBe('Plan assigned successfully');
      expect(result.clientIds).toEqual(assignDto.clientIds);
    });

    it('should throw ForbiddenException if trainer does not own plan', async () => {
      const otherTrainerProfileId = '507f1f77bcf86cd799439021';
      const otherPlan = { ...mockPlan, trainerId: new Types.ObjectId(otherTrainerProfileId) };

      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(otherPlan),
          }),
        }),
      });

      const assignDto: AssignPlanDto = {
        clientIds: [mockClientId],
        startDate: new Date('2024-01-01').toISOString(),
      };

      await expect(
        service.assignPlanToClients(mockPlanId, mockTrainerId, assignDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('duplicatePlan', () => {
    it('should duplicate a plan', async () => {
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockPlan),
          }),
        }),
      });

      const duplicatedPlan = {
        ...mockPlan,
        name: `${mockPlan.name} (Copy)`,
        assignedClientIds: [],
      };
      const mockInstance = {
        ...duplicatedPlan,
        save: jest.fn().mockResolvedValue(duplicatedPlan),
      };
      (planModel as any).mockImplementation(() => mockInstance);

      const result = await service.duplicatePlan(mockPlanId, mockTrainerId);

      expect(planModel).toHaveBeenCalled();
      expect(mockInstance.save).toHaveBeenCalled();
      expect(result.name).toBe('Test Plan (Copy)');
      expect(result.assignedClientIds).toEqual([]);
    });
  });
});

