import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { PlansService } from './plans.service';
import { WeeklyPlan, WeeklyPlanDocument } from './schemas/weekly-plan.schema';
import { TrainerProfile } from '../trainers/schemas/trainer-profile.schema';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { User } from '../users/schemas/user.schema';
import { WorkoutLog } from '../workouts/schemas/workout-log.schema';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { TrainersService } from '../trainers/trainers.service';
import { GamificationService } from '../gamification/gamification.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { WorkoutDifficulty } from '../common/enums/workout-difficulty.enum';

describe('PlansService', () => {
  let service: PlansService;
  let planModel: jest.Mocked<Model<WeeklyPlanDocument>>;
  let clientModel: jest.Mocked<Model<ClientProfileDocument>>;
  let clientsService: jest.Mocked<ClientsService>;
  let workoutsService: jest.Mocked<WorkoutsService>;
  let trainersService: jest.Mocked<TrainersService>;
  let gamificationService: jest.Mocked<GamificationService>;

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
    difficulty: WorkoutDifficulty.INTERMEDIATE,
    workouts: [
      {
        dayOfWeek: 1,
        isRestDay: false,
        name: 'Monday Workout',
        exercises: [
          { name: 'Squat', sets: 3, reps: '10', restSeconds: 60 },
        ],
        estimatedDuration: 60,
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
          provide: getModelToken(TrainerProfile.name),
          useValue: {
            findById: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getModelToken(ClientProfile.name),
          useValue: {
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({}),
            }),
            find: jest.fn(),
            updateOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
            }),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: getModelToken(WorkoutLog.name),
          useValue: {
            find: jest.fn(),
            deleteMany: jest.fn(),
            countDocuments: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(0),
            }),
          },
        },
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
            getProfileById: jest.fn(),
            updateProfile: jest.fn(),
            hasPlanInHistory: jest.fn(),
            getActivePlanEntry: jest.fn(),
          },
        },
        {
          provide: WorkoutsService,
          useValue: {
            generateWeeklyLogs: jest.fn(),
            getWorkoutLogsByClient: jest.fn().mockResolvedValue([]),
            deleteUncompletedWorkoutsForPlan: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: TrainersService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
        {
          provide: GamificationService,
          useValue: {
            removePenaltiesForPlan: jest.fn().mockResolvedValue(0),
            addPenaltyToBalance: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    planModel = module.get(getModelToken(WeeklyPlan.name));
    clientModel = module.get(getModelToken(ClientProfile.name));
    clientsService = module.get(ClientsService);
    workoutsService = module.get(WorkoutsService);
    trainersService = module.get(TrainersService);
    gamificationService = module.get(GamificationService);

    // Add methods to mockModelConstructor
    (planModel as any).find = jest.fn();
    (planModel as any).findOne = jest.fn(); // Used by getPlanById
    (planModel as any).findById = jest.fn();
    (planModel as any).findByIdAndUpdate = jest.fn();
    (planModel as any).findByIdAndDelete = jest.fn();
    (planModel as any).updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
    
    // Setup trainerModel.findById mock with populate chain for getPlanById
    const trainerModelMock = module.get(getModelToken(TrainerProfile.name));
    (trainerModelMock as any).findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockTrainerProfile,
            userId: {
              _id: new Types.ObjectId(mockTrainerId),
              firstName: 'Test',
              lastName: 'Trainer',
              email: 'trainer@test.com',
            },
          }),
        }),
      }),
    });
    
    // Default mock for trainersService.getProfile
    trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Re-setup default mock for trainersService.getProfile after clearing
    if (trainersService && trainersService.getProfile) {
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
    }
  });

  describe('createPlan', () => {
    it('should create a new plan', async () => {
      const createDto: CreatePlanDto = {
        name: 'New Plan',
        description: 'Plan Description',
        difficulty: WorkoutDifficulty.BEGINNER,
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

    it('should handle trainerId in DTO (admin case)', async () => {
      const adminUserId = 'admin123';
      const targetTrainerId = '507f1f77bcf86cd799439025'; // Valid ObjectId string
      const createDto: CreatePlanDto = {
        name: 'Admin Created Plan',
        description: 'Plan Description',
        difficulty: WorkoutDifficulty.BEGINNER,
        workouts: [],
        isTemplate: true,
        trainerId: targetTrainerId, // Admin provides trainerId
      };

      const targetTrainerProfile = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(targetTrainerId),
      };

      trainersService.getProfile.mockResolvedValue(targetTrainerProfile as any);

      const savedPlan = { ...mockPlan, ...createDto, trainerId: targetTrainerProfile._id };
      const mockInstance = {
        ...createDto,
        save: jest.fn().mockResolvedValue(savedPlan),
      };
      (planModel as any).mockImplementation(() => mockInstance);

      const result = await service.createPlan(adminUserId, createDto);

      expect(trainersService.getProfile).toHaveBeenCalledWith(targetTrainerId); // Should use trainerId from DTO
      // Service converts trainerId (userId string) to trainerProfileId (ObjectId) and removes trainerId from result
      const { trainerId, ...expectedDto } = createDto;
      expect(result).toMatchObject(expectedDto);
      expect(result.trainerId).toEqual(targetTrainerProfile._id); // Should use trainerProfileId ObjectId
    });

    it('should handle missing trainerId (trainer case)', async () => {
      const trainerUserId = mockTrainerId;
      const createDto: CreatePlanDto = {
        name: 'Trainer Created Plan',
        description: 'Plan Description',
        difficulty: WorkoutDifficulty.BEGINNER,
        workouts: [],
        isTemplate: true,
        // No trainerId - should use current user
      };

      const savedPlan = { ...mockPlan, ...createDto };
      const mockInstance = {
        ...createDto,
        save: jest.fn().mockResolvedValue(savedPlan),
      };
      (planModel as any).mockImplementation(() => mockInstance);

      const result = await service.createPlan(trainerUserId, createDto);

      expect(trainersService.getProfile).toHaveBeenCalledWith(trainerUserId); // Should use current user
      expect(result).toMatchObject(createDto);
    });

    it('should set isTemplate to true by default', async () => {
      const createDto: CreatePlanDto = {
        name: 'Plan Without isTemplate',
        description: 'Plan Description',
        difficulty: WorkoutDifficulty.BEGINNER,
        workouts: [],
        // isTemplate not specified
      };

      const savedPlan = { ...mockPlan, ...createDto, isTemplate: true };
      const mockInstance = {
        ...createDto,
        save: jest.fn().mockResolvedValue(savedPlan),
      };
      (planModel as any).mockImplementation(() => mockInstance);

      const result = await service.createPlan(mockTrainerId, createDto);

      expect(planModel).toHaveBeenCalled();
      const planCall = (planModel as any).mock.calls[0][0];
      expect(planCall.isTemplate).toBe(true); // Should default to true
    });

    it('should handle isTemplate explicitly set to false', async () => {
      const createDto: CreatePlanDto = {
        name: 'Plan With isTemplate False',
        description: 'Plan Description',
        difficulty: WorkoutDifficulty.BEGINNER,
        workouts: [],
        isTemplate: false,
      };

      const savedPlan = { ...mockPlan, ...createDto };
      const mockInstance = {
        ...createDto,
        save: jest.fn().mockResolvedValue(savedPlan),
      };
      (planModel as any).mockImplementation(() => mockInstance);

      const result = await service.createPlan(mockTrainerId, createDto);

      expect(planModel).toHaveBeenCalled();
      const planCall = (planModel as any).mock.calls[0][0];
      expect(planCall.isTemplate).toBe(false);
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
        isDeleted: { $ne: true }, // Service adds this filter
      });
      expect(result).toEqual(plans);
    });

    it('should return only non-deleted plans', async () => {
      const plans = [
        { ...mockPlan, isDeleted: false },
        { ...mockPlan, _id: new Types.ObjectId(), isDeleted: true }, // Should be filtered out
      ];
      (planModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(plans.filter(p => !p.isDeleted)),
            }),
          }),
        }),
      });

      const result = await service.getPlans(mockTrainerId);

      expect((planModel as any).find).toHaveBeenCalledWith({
        trainerId: new Types.ObjectId(mockTrainerProfileId),
        isDeleted: { $ne: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].isDeleted).toBeFalsy();
    });

    it('should populate assignedClientIds', async () => {
      const plans = [mockPlan];
      const populateMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(plans),
        }),
      });
      (planModel as any).find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: populateMock,
        }),
      });

      await service.getPlans(mockTrainerId);

      // Service populates both 'assignedClientIds' and 'userId'
      expect(populateMock).toHaveBeenCalled();
      const populateCalls = populateMock.mock.calls;
      expect(populateCalls.some(call => call[0] === 'assignedClientIds')).toBe(true);
    });
  });

  describe('getPlanById', () => {
    const mockUserId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
      (trainersService.getProfile as jest.Mock).mockResolvedValue({
        _id: mockTrainerProfileId,
        userId: mockUserId,
      });
    });

    it('should return a plan by id for TRAINER role when plan belongs to trainer', async () => {
      // Service uses findOne with query object, not findById
      // When using .lean(), Mongoose returns plain objects, so trainerId is an ObjectId instance
      const planWithTrainerId = {
        ...mockPlan,
        trainerId: new Types.ObjectId(mockTrainerProfileId), // Plain ObjectId for lean() result
      };
      (planModel as any).findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(planWithTrainerId),
            }),
          }),
        }),
      });

      const result = await service.getPlanById(mockPlanId, mockUserId, 'TRAINER');

      // TRAINER role allows access to soft-deleted plans, so isDeleted is NOT in query
      expect((planModel as any).findOne).toHaveBeenCalledWith({
        _id: mockPlanId,
      });
      expect(trainersService.getProfile).toHaveBeenCalledWith(mockUserId);
      expect(result).toBeDefined();
    });

    it('should return a plan by id for ADMIN role without ownership check', async () => {
      const planWithTrainerId = {
        ...mockPlan,
        trainerId: new Types.ObjectId(mockTrainerProfileId),
      };
      (planModel as any).findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(planWithTrainerId),
            }),
          }),
        }),
      });

      const result = await service.getPlanById(mockPlanId, mockUserId, 'ADMIN');

      expect((planModel as any).findOne).toHaveBeenCalledWith({
        _id: mockPlanId,
        isDeleted: { $ne: true },
      });
      // ADMIN should not check ownership
      expect(trainersService.getProfile).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for TRAINER role when plan does not belong to trainer', async () => {
      const differentTrainerProfileId = new Types.ObjectId();
      const planWithDifferentTrainerId = {
        ...mockPlan,
        trainerId: differentTrainerProfileId,
      };
      (planModel as any).findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(planWithDifferentTrainerId),
            }),
          }),
        }),
      });

      await expect(service.getPlanById(mockPlanId, mockUserId, 'TRAINER')).rejects.toThrow(
        ForbiddenException,
      );
      expect(trainersService.getProfile).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw NotFoundException if plan not found', async () => {
      // Service uses findOne with query object, not findById
      (planModel as any).findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
          }),
        }),
      });

      await expect(service.getPlanById(mockPlanId, mockUserId, 'TRAINER')).rejects.toThrow(
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
          exec: jest.fn().mockResolvedValue(mockPlan),
        }),
      });

      const updatedPlan = { ...mockPlan, ...updateDto };
      (planModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedPlan),
      });

      const result = await service.updatePlan(mockPlanId, mockTrainerId, 'TRAINER', updateDto);

      // Service uses updateFields directly, not { $set: updateDto }
      expect((planModel as any).findByIdAndUpdate).toHaveBeenCalledWith(
        mockPlanId,
        updateDto, // Service builds updateFields object directly
        { new: true },
      );
      expect(result).toEqual(updatedPlan);
    });

    it('should throw ForbiddenException if trainer does not own plan', async () => {
      const otherTrainerProfileId = '507f1f77bcf86cd799439021';
      const otherPlan = { ...mockPlan, trainerId: new Types.ObjectId(otherTrainerProfileId) };

      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(otherPlan),
        }),
      });

      await expect(
        service.updatePlan(mockPlanId, mockTrainerId, 'TRAINER', { name: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePlan', () => {
    let workoutLogModel: jest.Mocked<Model<any>>;

    beforeEach(() => {
      workoutLogModel = {
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        }),
      } as any;
      (service as any).workoutLogModel = workoutLogModel;
    });

    it('should hard delete a plan when no active logs and no assigned clients', async () => {
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      
      const planWithoutClients = {
        ...mockPlan,
        assignedClientIds: [],
      };
      
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(planWithoutClients),
        }),
      });

      workoutLogModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0), // No active logs
      } as any);

      (planModel as any).findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(planWithoutClients),
      });

      await service.deletePlan(mockPlanId, mockTrainerId, 'TRAINER');

      // MERODAVNOST PROVERA: Should use hard delete (findByIdAndDelete) when no active logs and no assigned clients
      expect(workoutLogModel.countDocuments).toHaveBeenCalledWith({
        weeklyPlanId: new Types.ObjectId(mockPlanId),
        workoutDate: { $gte: expect.any(Date) },
      });
      expect((planModel as any).findByIdAndDelete).toHaveBeenCalledWith(mockPlanId);
      expect((planModel as any).findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should soft delete a plan when it has active logs', async () => {
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      
      const planWithoutClients = {
        ...mockPlan,
        assignedClientIds: [],
      };
      
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(planWithoutClients),
        }),
      });

      workoutLogModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5), // Has active logs
      } as any);

      (planModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...planWithoutClients,
          isDeleted: true,
          deletedAt: expect.any(Date),
        }),
      });

      await service.deletePlan(mockPlanId, mockTrainerId, 'TRAINER');

      // MERODAVNOST PROVERA: Should use soft delete (findByIdAndUpdate with isDeleted: true) when has active logs
      expect(workoutLogModel.countDocuments).toHaveBeenCalledWith({
        weeklyPlanId: new Types.ObjectId(mockPlanId),
        workoutDate: { $gte: expect.any(Date) },
      });
      expect((planModel as any).findByIdAndUpdate).toHaveBeenCalledWith(
        mockPlanId,
        {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
      );
      expect((planModel as any).findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should soft delete a plan when it has assigned clients', async () => {
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      
      const planWithClients = {
        ...mockPlan,
        assignedClientIds: [new Types.ObjectId(mockClientId)],
      };
      
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(planWithClients),
        }),
      });

      workoutLogModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0), // No active logs
      } as any);

      (planModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...planWithClients,
          isDeleted: true,
          deletedAt: expect.any(Date),
        }),
      });

      await service.deletePlan(mockPlanId, mockTrainerId, 'TRAINER');

      // MERODAVNOST PROVERA: Should use soft delete when has assigned clients, even if no active logs
      expect((planModel as any).findByIdAndUpdate).toHaveBeenCalledWith(
        mockPlanId,
        {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
      );
      expect((planModel as any).findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should soft delete a plan when it has both active logs and assigned clients', async () => {
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      
      const planWithClients = {
        ...mockPlan,
        assignedClientIds: [new Types.ObjectId(mockClientId)],
      };
      
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(planWithClients),
        }),
      });

      workoutLogModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(3), // Has active logs
      } as any);

      (planModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...planWithClients,
          isDeleted: true,
          deletedAt: expect.any(Date),
        }),
      });

      await service.deletePlan(mockPlanId, mockTrainerId, 'TRAINER');

      // MERODAVNOST PROVERA: Should use soft delete when has both active logs and assigned clients
      expect((planModel as any).findByIdAndUpdate).toHaveBeenCalledWith(
        mockPlanId,
        {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
      );
      expect((planModel as any).findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should handle plan with null assignedClientIds', async () => {
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      
      const planWithNullClients = {
        ...mockPlan,
        assignedClientIds: null,
      };
      
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(planWithNullClients),
        }),
      });

      workoutLogModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      } as any);

      (planModel as any).findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(planWithNullClients),
      });

      await service.deletePlan(mockPlanId, mockTrainerId, 'TRAINER');

      // MERODAVNOST PROVERA: null assignedClientIds should be treated as empty array (length = 0)
      expect((planModel as any).findByIdAndDelete).toHaveBeenCalledWith(mockPlanId);
    });

    it('should delete a plan as ADMIN without ownership check', async () => {
      const planWithoutClients = {
        ...mockPlan,
        assignedClientIds: [],
      };
      
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(planWithoutClients),
        }),
      });

      workoutLogModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      } as any);

      (planModel as any).findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(planWithoutClients),
      });

      await service.deletePlan(mockPlanId, mockTrainerId, 'ADMIN');

      expect((planModel as any).findByIdAndDelete).toHaveBeenCalledWith(mockPlanId);
      expect(trainersService.getProfile).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if trainer tries to delete plan they do not own', async () => {
      const otherTrainerProfileId = new Types.ObjectId('507f1f77bcf86cd799439021');
      const planWithOtherTrainer = {
        ...mockPlan,
        trainerId: otherTrainerProfileId,
        assignedClientIds: [],
      };
      
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(planWithOtherTrainer),
        }),
      });

      await expect(service.deletePlan(mockPlanId, mockTrainerId, 'TRAINER')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.deletePlan(mockPlanId, mockTrainerId, 'TRAINER')).rejects.toThrow(
        'You can only delete your own plans',
      );
    });

    it('should throw NotFoundException if plan not found', async () => {
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      
      (planModel as any).findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.deletePlan(mockPlanId, mockTrainerId, 'TRAINER')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deletePlan(mockPlanId, mockTrainerId, 'TRAINER')).rejects.toThrow(
        'Plan not found',
      );
    });
  });

  describe('assignPlanToClients', () => {
    it('should assign plan to clients and generate workout logs', async () => {
      // Use today's date to pass validation (PlanValidators.validateStartDate allows today or future dates)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const assignDto: AssignPlanDto = {
        clientIds: [mockClientId],
        startDate: today.toISOString(),
      };

      // Service uses findById(...).populate(...).exec() chain
      const mockFindByIdChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPlan),
      };
      (planModel as any).findById.mockReturnValue(mockFindByIdChain);

      (planModel as any).findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });

      clientsService.getProfileById.mockResolvedValue(mockClientProfile as any);
      clientsService.updateProfile.mockResolvedValue(mockClientProfile as any);
      clientsService.hasPlanInHistory.mockResolvedValue(false); // Plan not in history yet
      workoutsService.generateWeeklyLogs.mockResolvedValue([]);

      const result = await service.assignPlanToClients(
        mockPlanId,
        mockTrainerId,
        'TRAINER',
        assignDto,
      );

      expect((planModel as any).findById).toHaveBeenCalledWith(mockPlanId);
      expect(mockFindByIdChain.populate).toHaveBeenCalledWith('trainerId', 'userId');
      expect(mockFindByIdChain.exec).toHaveBeenCalled();
      // Service now uses clientModel.findByIdAndUpdate directly instead of updateProfile
      expect(clientsService.getProfileById).toHaveBeenCalled();
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

      // Service uses findById(...).populate(...).exec() chain
      const mockFindByIdChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(otherPlan),
      };
      (planModel as any).findById.mockReturnValue(mockFindByIdChain);

      const assignDto: AssignPlanDto = {
        clientIds: [mockClientId],
        startDate: new Date('2024-01-01').toISOString(),
      };

      await expect(
        service.assignPlanToClients(mockPlanId, mockTrainerId, 'TRAINER', assignDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('duplicatePlan', () => {
    it('should duplicate a plan as TRAINER', async () => {
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      
      (planModel as any).findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockPlan),
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

      const result = await service.duplicatePlan(mockPlanId, mockTrainerId, 'TRAINER');

      expect(planModel).toHaveBeenCalled();
      expect(mockInstance.save).toHaveBeenCalled();
      expect(result.name).toBe('Test Plan (Copy)');
      expect(result.assignedClientIds).toEqual([]);
    });

    it('should duplicate a plan as ADMIN keeping original trainerId', async () => {
      (planModel as any).findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockPlan),
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

      const result = await service.duplicatePlan(mockPlanId, mockTrainerId, 'ADMIN');

      expect(planModel).toHaveBeenCalled();
      expect(mockInstance.save).toHaveBeenCalled();
      expect(result.name).toBe('Test Plan (Copy)');
      expect(result.assignedClientIds).toEqual([]);
      expect(trainersService.getProfile).not.toHaveBeenCalled();
    });
  });

  describe('canUnlockNextWeek', () => {
    it('should return true if no currentPlanId', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const clientWithoutPlan = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: null,
        planHistory: [],
      };

      clientsService.getProfileById.mockResolvedValue(clientWithoutPlan as any);

      const result = await service.canUnlockNextWeek(clientProfileId);

      expect(result).toBe(true);
      expect(clientsService.getProfileById).toHaveBeenCalledWith(clientProfileId);
      expect(workoutsService.getWorkoutLogsByClient).not.toHaveBeenCalled();
    });

    it('should return true if currentPlanId not in planHistory (data inconsistency)', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const currentPlanId = new Types.ObjectId();
      const clientWithInconsistentData = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: new Types.ObjectId(), // Different planId
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(),
          },
        ],
      };

      clientsService.getProfileById.mockResolvedValue(clientWithInconsistentData as any);
      clientsService.getActivePlanEntry.mockReturnValue(null); // Not found in planHistory

      const result = await service.canUnlockNextWeek(clientProfileId);

      expect(result).toBe(true); // Recovery mechanism
      expect(clientsService.getProfileById).toHaveBeenCalledWith(clientProfileId);
      expect(clientsService.getActivePlanEntry).toHaveBeenCalledWith(clientWithInconsistentData);
    });

    it('should return false if last workout day has not passed', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const currentPlanId = new Types.ObjectId();
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const clientWithCurrentPlan = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(),
          },
        ],
      };

      const plan = {
        ...mockPlan,
        _id: currentPlanId,
        workouts: [
          { dayOfWeek: 1, isRestDay: false, name: 'Monday Workout' },
          { dayOfWeek: 2, isRestDay: false, name: 'Tuesday Workout' },
        ],
      };

      const workoutLogs = [
        {
          workoutDate: today, // Today - last workout day hasn't passed
          dayOfWeek: 1,
          weeklyPlanId: currentPlanId,
          isCompleted: true,
          isMissed: false,
        },
      ];

      clientsService.getProfileById.mockResolvedValue(clientWithCurrentPlan as any);
      clientsService.getActivePlanEntry.mockReturnValue({
        planId: currentPlanId,
        planStartDate: new Date('2025-01-01'),
        planEndDate: new Date('2025-01-07'),
        assignedAt: new Date(),
        trainerId: new Types.ObjectId(),
      });
      workoutsService.getWorkoutLogsByClient.mockResolvedValue(workoutLogs as any);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(plan),
      });

      const result = await service.canUnlockNextWeek(clientProfileId);

      expect(result).toBe(false);
      expect(clientsService.getProfileById).toHaveBeenCalledWith(clientProfileId);
      expect(workoutsService.getWorkoutLogsByClient).toHaveBeenCalledWith(clientProfileId);
    });

    it('should return true if all non-rest-day workouts are completed', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const currentPlanId = new Types.ObjectId();
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const clientWithCurrentPlan = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(),
          },
        ],
      };

      const plan = {
        ...mockPlan,
        _id: currentPlanId,
        workouts: [
          { dayOfWeek: 1, isRestDay: false, name: 'Monday Workout' },
          { dayOfWeek: 2, isRestDay: true, name: 'Rest Day' }, // Rest day
          { dayOfWeek: 3, isRestDay: false, name: 'Wednesday Workout' },
        ],
      };

      const workoutLogs = [
        {
          workoutDate: lastWeek,
          dayOfWeek: 1,
          weeklyPlanId: currentPlanId,
          isCompleted: true,
          isMissed: false,
        },
        {
          workoutDate: lastWeek,
          dayOfWeek: 3,
          weeklyPlanId: currentPlanId,
          isCompleted: true,
          isMissed: false,
        },
      ];

      clientsService.getProfileById.mockResolvedValue(clientWithCurrentPlan as any);
      clientsService.getActivePlanEntry.mockReturnValue({
        planId: currentPlanId,
        planStartDate: new Date('2025-01-01'),
        planEndDate: new Date('2025-01-07'),
        assignedAt: new Date(),
        trainerId: new Types.ObjectId(),
      });
      workoutsService.getWorkoutLogsByClient.mockResolvedValue(workoutLogs as any);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(plan),
      });

      const result = await service.canUnlockNextWeek(clientProfileId);

      expect(result).toBe(true);
      expect(workoutsService.getWorkoutLogsByClient).toHaveBeenCalledWith(clientProfileId);
    });

    it('should return false if any non-rest-day workout is incomplete', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const currentPlanId = new Types.ObjectId();
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const clientWithCurrentPlan = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(),
          },
        ],
      };

      const plan = {
        ...mockPlan,
        _id: currentPlanId,
        workouts: [
          { dayOfWeek: 1, isRestDay: false, name: 'Monday Workout' },
          { dayOfWeek: 2, isRestDay: false, name: 'Tuesday Workout' },
        ],
      };

      const workoutLogs = [
        {
          workoutDate: lastWeek,
          dayOfWeek: 1,
          weeklyPlanId: currentPlanId,
          isCompleted: true,
          isMissed: false,
        },
        {
          workoutDate: lastWeek,
          dayOfWeek: 2,
          weeklyPlanId: currentPlanId,
          isCompleted: false, // Incomplete
          isMissed: false,
        },
      ];

      clientsService.getProfileById.mockResolvedValue(clientWithCurrentPlan as any);
      clientsService.getActivePlanEntry.mockReturnValue({
        planId: currentPlanId,
        planStartDate: new Date('2025-01-01'),
        planEndDate: new Date('2025-01-07'),
        assignedAt: new Date(),
        trainerId: new Types.ObjectId(),
      });
      workoutsService.getWorkoutLogsByClient.mockResolvedValue(workoutLogs as any);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(plan),
      });

      const result = await service.canUnlockNextWeek(clientProfileId);

      expect(result).toBe(false);
    });

    it('should ignore rest days in completion check', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const currentPlanId = new Types.ObjectId();
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const clientWithCurrentPlan = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(),
          },
        ],
      };

      const plan = {
        ...mockPlan,
        _id: currentPlanId,
        workouts: [
          { dayOfWeek: 1, isRestDay: false, name: 'Monday Workout' },
          { dayOfWeek: 2, isRestDay: true, name: 'Rest Day' }, // Rest day
          { dayOfWeek: 3, isRestDay: false, name: 'Wednesday Workout' },
        ],
      };

      const workoutLogs = [
        {
          workoutDate: lastWeek,
          dayOfWeek: 1,
          weeklyPlanId: currentPlanId,
          isCompleted: true,
          isMissed: false,
        },
        {
          workoutDate: lastWeek,
          dayOfWeek: 2,
          weeklyPlanId: currentPlanId,
          isCompleted: false, // Rest day incomplete - should be ignored
          isMissed: false,
        },
        {
          workoutDate: lastWeek,
          dayOfWeek: 3,
          weeklyPlanId: currentPlanId,
          isCompleted: true,
          isMissed: false,
        },
      ];

      clientsService.getProfileById.mockResolvedValue(clientWithCurrentPlan as any);
      clientsService.getActivePlanEntry.mockReturnValue({
        planId: currentPlanId,
        planStartDate: new Date('2025-01-01'),
        planEndDate: new Date('2025-01-07'),
        assignedAt: new Date(),
        trainerId: new Types.ObjectId(),
      });
      workoutsService.getWorkoutLogsByClient.mockResolvedValue(workoutLogs as any);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(plan),
      });

      const result = await service.canUnlockNextWeek(clientProfileId);

      expect(result).toBe(true); // Rest day incomplete should be ignored
    });

    it('should return true if plan deleted', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const currentPlanId = new Types.ObjectId();

      const clientWithCurrentPlan = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(),
          },
        ],
      };

      const workoutLogs = [
        {
          workoutDate: new Date(),
          dayOfWeek: 1,
          weeklyPlanId: currentPlanId,
          isCompleted: true,
          isMissed: false,
        },
      ];

      clientsService.getProfileById.mockResolvedValue(clientWithCurrentPlan as any);
      clientsService.getActivePlanEntry.mockReturnValue({
        planId: currentPlanId,
        planStartDate: new Date('2025-01-01'),
        planEndDate: new Date('2025-01-07'),
        assignedAt: new Date(),
        trainerId: new Types.ObjectId(),
      });
      workoutsService.getWorkoutLogsByClient.mockResolvedValue(workoutLogs as any);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // Plan deleted
      });

      const result = await service.canUnlockNextWeek(clientProfileId);

      expect(result).toBe(true); // Recovery mechanism
    });

    it('should return true if no workout logs for current plan', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const currentPlanId = new Types.ObjectId();

      const clientWithCurrentPlan = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(),
          },
        ],
      };

      clientsService.getProfileById.mockResolvedValue(clientWithCurrentPlan as any);
      clientsService.getActivePlanEntry.mockReturnValue({
        planId: currentPlanId,
        planStartDate: new Date('2025-01-01'),
        planEndDate: new Date('2025-01-07'),
        assignedAt: new Date(),
        trainerId: new Types.ObjectId(),
      });
      workoutsService.getWorkoutLogsByClient.mockResolvedValue([]); // No workout logs

      const result = await service.canUnlockNextWeek(clientProfileId);

      // Business logic: Must complete at least one workout before unlocking next week
      expect(result).toBe(false);
    });

    it('should handle client with null planHistory', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const currentPlanId = new Types.ObjectId();

      const clientWithNullHistory = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: currentPlanId,
        planHistory: null,
      };

      clientsService.getProfileById.mockResolvedValue(clientWithNullHistory as any);
      clientsService.getActivePlanEntry.mockReturnValue(null); // Not found due to null history

      const result = await service.canUnlockNextWeek(clientProfileId);

      expect(result).toBe(true); // Recovery mechanism
    });

    it('should handle planHistory with multiple plans', async () => {
      const clientProfileId = new Types.ObjectId().toString();
      const currentPlanId = new Types.ObjectId();
      const otherPlanId = new Types.ObjectId();
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const clientWithMultiplePlans = {
        ...mockClientProfile,
        _id: new Types.ObjectId(clientProfileId),
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: otherPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(),
          },
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-08'),
            planEndDate: new Date('2025-01-14'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(),
          },
        ],
      };

      const plan = {
        ...mockPlan,
        _id: currentPlanId,
        workouts: [
          { dayOfWeek: 1, isRestDay: false, name: 'Monday Workout' },
        ],
      };

      const workoutLogs = [
        {
          workoutDate: lastWeek,
          dayOfWeek: 1,
          weeklyPlanId: currentPlanId,
          isCompleted: true,
          isMissed: false,
        },
      ];

      clientsService.getProfileById.mockResolvedValue(clientWithMultiplePlans as any);
      clientsService.getActivePlanEntry.mockReturnValue({
        planId: currentPlanId,
        planStartDate: new Date('2025-01-08'),
        planEndDate: new Date('2025-01-14'),
        assignedAt: new Date(),
        trainerId: new Types.ObjectId(),
      });
      workoutsService.getWorkoutLogsByClient.mockResolvedValue(workoutLogs as any);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(plan),
      });

      const result = await service.canUnlockNextWeek(clientProfileId);

      expect(result).toBe(true);
      expect(clientsService.getActivePlanEntry).toHaveBeenCalledWith(clientWithMultiplePlans);
    });
  });

  describe('cancelPlan', () => {
    const planId = mockPlanId;
    const clientId = mockClientId;
    const userId = mockTrainerId;
    const userRole = 'TRAINER';

    beforeEach(() => {
      gamificationService.removePenaltiesForPlan.mockResolvedValue(2);
      workoutsService.deleteUncompletedWorkoutsForPlan.mockResolvedValue(5);
    });

    it('should delete uncompleted workout logs', async () => {
      const clientProfileId = new Types.ObjectId(mockClientId);
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: new Types.ObjectId(planId),
        planHistory: [
          {
            planId: new Types.ObjectId(planId),
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });
      clientsService.getProfile.mockResolvedValue(client as any);
      clientsService.getProfileById.mockResolvedValue(client as any);
      (clientModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      (planModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      await service.cancelPlan(planId, clientId, userId, userRole);

      expect(workoutsService.deleteUncompletedWorkoutsForPlan).toHaveBeenCalledWith(
        clientProfileId.toString(),
        planId,
      );
    });

    it('should remove penalties for plan', async () => {
      const clientProfileId = new Types.ObjectId(mockClientId);
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: new Types.ObjectId(planId),
        planHistory: [
          {
            planId: new Types.ObjectId(planId),
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });
      clientsService.getProfile.mockResolvedValue(client as any);
      clientsService.getProfileById.mockResolvedValue(client as any);
      (clientModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      (planModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      await service.cancelPlan(planId, clientId, userId, userRole);

      expect(gamificationService.removePenaltiesForPlan).toHaveBeenCalledWith(
        clientProfileId.toString(),
        planId,
      );
    });

    it('should remove plan from planHistory', async () => {
      const clientProfileId = new Types.ObjectId(mockClientId);
      const otherPlanId = new Types.ObjectId();
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: new Types.ObjectId(planId),
        planHistory: [
          {
            planId: new Types.ObjectId(planId),
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
          {
            planId: otherPlanId,
            planStartDate: new Date('2025-01-08'),
            planEndDate: new Date('2025-01-14'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });
      clientsService.getProfile.mockResolvedValue(client as any);
      clientsService.getProfileById.mockResolvedValue(client as any);
      (clientModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      (planModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      await service.cancelPlan(planId, clientId, userId, userRole);

      expect(clientModel.updateOne).toHaveBeenCalledWith(
        { _id: clientProfileId },
        expect.objectContaining({
          $pull: { planHistory: { planId: new Types.ObjectId(planId) } },
        }),
      );
    });

    it('should clear currentPlanId if it matches cancelled plan', async () => {
      const clientProfileId = new Types.ObjectId(mockClientId);
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: new Types.ObjectId(planId),
        planHistory: [
          {
            planId: new Types.ObjectId(planId),
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });
      clientsService.getProfile.mockResolvedValue(client as any);
      clientsService.getProfileById.mockResolvedValue(client as any);
      (clientModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      (planModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      await service.cancelPlan(planId, clientId, userId, userRole);

      expect(clientModel.updateOne).toHaveBeenCalledWith(
        { _id: clientProfileId },
        expect.objectContaining({
          $pull: { planHistory: { planId: new Types.ObjectId(planId) } },
          $set: { currentPlanId: null },
        }),
      );
    });

    it('should NOT clear currentPlanId if it does not match', async () => {
      const clientProfileId = new Types.ObjectId(mockClientId);
      const otherPlanId = new Types.ObjectId();
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: otherPlanId, // Different plan
        planHistory: [
          {
            planId: new Types.ObjectId(planId),
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });
      clientsService.getProfile.mockResolvedValue(client as any);
      clientsService.getProfileById.mockResolvedValue(client as any);
      (clientModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      (planModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      await service.cancelPlan(planId, clientId, userId, userRole);

      expect(clientModel.updateOne).toHaveBeenCalledWith(
        { _id: clientProfileId },
        expect.objectContaining({
          $pull: { planHistory: { planId: new Types.ObjectId(planId) } },
        }),
      );
      // Should NOT have $set with currentPlanId: null
      const updateCall = (clientModel.updateOne as jest.Mock).mock.calls[0][1];
      expect(updateCall.$set).toBeUndefined();
    });

    it('should remove client from plan assignedClientIds', async () => {
      const clientProfileId = new Types.ObjectId(mockClientId);
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: new Types.ObjectId(planId),
        planHistory: [
          {
            planId: new Types.ObjectId(planId),
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      const planWithClients = {
        ...mockPlan,
        _id: new Types.ObjectId(planId),
        assignedClientIds: [clientProfileId, new Types.ObjectId()],
      };

      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(planWithClients),
      });
      clientsService.getProfile.mockResolvedValue(client as any);
      clientsService.getProfileById.mockResolvedValue(client as any);
      (clientModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      (planModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      await service.cancelPlan(planId, clientId, userId, userRole);

      expect(planModel.updateOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(planId) },
        { $pull: { assignedClientIds: clientProfileId } },
      );
    });

    it('should throw NotFoundException if plan not found', async () => {
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.cancelPlan(planId, clientId, userId, userRole)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.cancelPlan(planId, clientId, userId, userRole)).rejects.toThrow(
        'Plan not found',
      );
    });

    it('should throw NotFoundException if client not found', async () => {
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });
      clientsService.getProfile.mockRejectedValue(new NotFoundException('Client not found'));
      clientsService.getProfileById.mockRejectedValue(new NotFoundException('Client not found'));

      await expect(service.cancelPlan(planId, clientId, userId, userRole)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.cancelPlan(planId, clientId, userId, userRole)).rejects.toThrow(
        'Client profile not found',
      );
    });

    it('should handle plan not in client planHistory', async () => {
      const clientProfileId = new Types.ObjectId(mockClientId);
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: null,
        planHistory: [], // Plan not in history
      };

      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });
      clientsService.getProfile.mockResolvedValue(client as any);
      clientsService.getProfileById.mockResolvedValue(client as any);
      (clientModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      (planModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      // Should not throw error, just skip
      await expect(service.cancelPlan(planId, clientId, userId, userRole)).resolves.not.toThrow();
    });

    it('should handle client with null planHistory', async () => {
      const clientProfileId = new Types.ObjectId(mockClientId);
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: null,
        planHistory: null, // Null planHistory
      };

      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });
      clientsService.getProfile.mockResolvedValue(client as any);
      clientsService.getProfileById.mockResolvedValue(client as any);
      (clientModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      (planModel.updateOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      // Should not throw error
      await expect(service.cancelPlan(planId, clientId, userId, userRole)).resolves.not.toThrow();
    });
  });

  describe('requestNextWeek', () => {
    const clientId = mockClientId;
    const clientProfileId = new Types.ObjectId(mockClientId);

    beforeEach(() => {
      gamificationService.addPenaltyToBalance.mockResolvedValue(undefined);
    });

    it('should throw BadRequestException if cannot unlock', async () => {
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: new Types.ObjectId(mockPlanId),
        planHistory: [
          {
            planId: new Types.ObjectId(mockPlanId),
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      clientsService.getProfileById.mockResolvedValue(client as any);
      
      // Mock canUnlockNextWeek to return false
      jest.spyOn(service, 'canUnlockNextWeek').mockResolvedValue(false);

      await expect(service.requestNextWeek(clientId)).rejects.toThrow(BadRequestException);
      await expect(service.requestNextWeek(clientId)).rejects.toThrow(
        'Cannot request next week. Current week must be completed first.',
      );
      expect(gamificationService.addPenaltyToBalance).not.toHaveBeenCalled();
    });

    it('should charge balance if weeklyCost > 0', async () => {
      const currentPlanId = new Types.ObjectId(mockPlanId);
      const nextPlanId = new Types.ObjectId();
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: currentPlanId,
        balance: 10,
        monthlyBalance: 5,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
          {
            planId: nextPlanId,
            planStartDate: new Date('2025-01-08'),
            planEndDate: new Date('2025-01-14'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      const nextPlan = {
        ...mockPlan,
        _id: nextPlanId,
        weeklyCost: 5,
      };

      clientsService.getProfileById.mockResolvedValue(client as any);
      jest.spyOn(service, 'canUnlockNextWeek').mockResolvedValue(true);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(nextPlan),
      });
      (clientModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...client, currentPlanId: nextPlanId }),
      });

      // Mock updated client after balance charge
      const updatedClient = {
        ...client,
        balance: 15, // 10 + 5
        monthlyBalance: 10, // 5 + 5
      };
      clientsService.getProfileById
        .mockResolvedValueOnce(client as any) // First call
        .mockResolvedValueOnce(updatedClient as any) // After balance charge
        .mockResolvedValueOnce(updatedClient as any); // Final call

      const result = await service.requestNextWeek(clientId);

      expect(gamificationService.addPenaltyToBalance).toHaveBeenCalledWith(
        clientProfileId,
        5, // weeklyCost
        'Weekly plan cost - Unlocked next week',
        nextPlanId,
      );
      expect(result).toHaveProperty('currentPlanId');
      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('monthlyBalance');
    });

    it('should NOT charge balance if weeklyCost = 0', async () => {
      const currentPlanId = new Types.ObjectId(mockPlanId);
      const nextPlanId = new Types.ObjectId();
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: currentPlanId,
        balance: 10,
        monthlyBalance: 5,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
          {
            planId: nextPlanId,
            planStartDate: new Date('2025-01-08'),
            planEndDate: new Date('2025-01-14'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      const nextPlan = {
        ...mockPlan,
        _id: nextPlanId,
        weeklyCost: 0, // No cost
      };

      clientsService.getProfileById.mockResolvedValue(client as any);
      jest.spyOn(service, 'canUnlockNextWeek').mockResolvedValue(true);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(nextPlan),
      });
      (clientModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...client, currentPlanId: nextPlanId }),
      });

      await service.requestNextWeek(clientId);

      expect(gamificationService.addPenaltyToBalance).not.toHaveBeenCalled();
    });

    it('should set currentPlanId to next plan', async () => {
      const currentPlanId = new Types.ObjectId(mockPlanId);
      const nextPlanId = new Types.ObjectId();
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
          {
            planId: nextPlanId,
            planStartDate: new Date('2025-01-08'),
            planEndDate: new Date('2025-01-14'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      const nextPlan = {
        ...mockPlan,
        _id: nextPlanId,
        weeklyCost: 0,
      };

      clientsService.getProfileById.mockResolvedValue(client as any);
      jest.spyOn(service, 'canUnlockNextWeek').mockResolvedValue(true);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(nextPlan),
      });
      (clientModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...client, currentPlanId: nextPlanId }),
      });

      await service.requestNextWeek(clientId);

      // MERODAVNOST PROVERA: Verify that currentPlanId is set to nextPlanId
      // Use direct call inspection to verify exact values (ObjectId handling)
      expect(clientModel.findByIdAndUpdate).toHaveBeenCalled();
      const updateCall = (clientModel.findByIdAndUpdate as jest.Mock).mock.calls[0];
      
      // Verify clientProfileId (handle ObjectId vs string)
      const calledClientId = updateCall[0];
      const calledClientIdStr = calledClientId?.toString() || calledClientId;
      const expectedClientIdStr = clientProfileId.toString();
      expect(calledClientIdStr).toBe(expectedClientIdStr);
      
      // Verify update structure and values
      expect(updateCall[1]).toHaveProperty('$set');
      const $set = updateCall[1].$set;
      
      // Verify currentPlanId matches nextPlanId (handle both ObjectId and string)
      const calledPlanId = $set.currentPlanId;
      const calledPlanIdStr = calledPlanId?.toString() || calledPlanId;
      const expectedPlanIdStr = nextPlanId.toString();
      expect(calledPlanIdStr).toBe(expectedPlanIdStr);
      
      // Verify other required fields
      expect($set.nextWeekRequested).toBe(false);
      expect($set.nextWeekRequestDate).toBeNull();
    });

    it('should find next plan in planHistory', async () => {
      const currentPlanId = new Types.ObjectId(mockPlanId);
      const nextPlanId = new Types.ObjectId();
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
          {
            planId: nextPlanId,
            planStartDate: new Date('2025-01-08'),
            planEndDate: new Date('2025-01-14'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      const nextPlan = {
        ...mockPlan,
        _id: nextPlanId,
        weeklyCost: 0,
      };

      const finalClient = {
        ...client,
        currentPlanId: nextPlanId,
        balance: 10,
        monthlyBalance: 5,
      };

      clientsService.getProfileById
        .mockResolvedValueOnce(client as any)
        .mockResolvedValueOnce(finalClient as any);
      jest.spyOn(service, 'canUnlockNextWeek').mockResolvedValue(true);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(nextPlan),
      });
      (clientModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(finalClient),
      });

      const result = await service.requestNextWeek(clientId);

      expect(result.currentPlanId).toBe(nextPlanId.toString());
    });

    it('should throw BadRequestException if no next plan available', async () => {
      const currentPlanId = new Types.ObjectId(mockPlanId);
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
          // No next plan
        ],
      };

      clientsService.getProfileById.mockResolvedValue(client as any);
      jest.spyOn(service, 'canUnlockNextWeek').mockResolvedValue(true);

      await expect(service.requestNextWeek(clientId)).rejects.toThrow(BadRequestException);
      await expect(service.requestNextWeek(clientId)).rejects.toThrow(
        'No next plan available. Your trainer has not assigned the next week yet.',
      );
    });

    it('should handle first unlock (no currentPlanId)', async () => {
      const nextPlanId = new Types.ObjectId();
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 7);

      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: null, // First unlock
        planHistory: [
          {
            planId: nextPlanId,
            planStartDate: futureDate,
            planEndDate: new Date(futureDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      const nextPlan = {
        ...mockPlan,
        _id: nextPlanId,
        weeklyCost: 0,
      };

      const finalClient = {
        ...client,
        currentPlanId: nextPlanId,
        balance: 10,
        monthlyBalance: 5,
      };

      clientsService.getProfileById
        .mockResolvedValueOnce(client as any)
        .mockResolvedValueOnce(finalClient as any);
      jest.spyOn(service, 'canUnlockNextWeek').mockResolvedValue(true);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(nextPlan),
      });
      (clientModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(finalClient),
      });

      const result = await service.requestNextWeek(clientId);

      expect(result.currentPlanId).toBe(nextPlanId.toString());
    });

    it('should return balance and monthlyBalance in response', async () => {
      const currentPlanId = new Types.ObjectId(mockPlanId);
      const nextPlanId = new Types.ObjectId();
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: currentPlanId,
        balance: 10,
        monthlyBalance: 5,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
          {
            planId: nextPlanId,
            planStartDate: new Date('2025-01-08'),
            planEndDate: new Date('2025-01-14'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      const nextPlan = {
        ...mockPlan,
        _id: nextPlanId,
        weeklyCost: 0,
      };

      const finalClient = {
        ...client,
        currentPlanId: nextPlanId,
        balance: 10,
        monthlyBalance: 5,
      };

      clientsService.getProfileById
        .mockResolvedValueOnce(client as any)
        .mockResolvedValueOnce(finalClient as any);
      jest.spyOn(service, 'canUnlockNextWeek').mockResolvedValue(true);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(nextPlan),
      });
      (clientModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(finalClient),
      });

      const result = await service.requestNextWeek(clientId);

      expect(result).toHaveProperty('currentPlanId', nextPlanId.toString());
      expect(result).toHaveProperty('balance', 10);
      expect(result).toHaveProperty('monthlyBalance', 5);
    });

    it('should handle planHistory with multiple plans', async () => {
      const currentPlanId = new Types.ObjectId(mockPlanId);
      const nextPlanId = new Types.ObjectId();
      const futurePlanId = new Types.ObjectId();
      const client = {
        ...mockClientProfile,
        _id: clientProfileId,
        currentPlanId: currentPlanId,
        planHistory: [
          {
            planId: currentPlanId,
            planStartDate: new Date('2025-01-01'),
            planEndDate: new Date('2025-01-07'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
          {
            planId: nextPlanId,
            planStartDate: new Date('2025-01-08'),
            planEndDate: new Date('2025-01-14'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
          {
            planId: futurePlanId,
            planStartDate: new Date('2025-01-15'),
            planEndDate: new Date('2025-01-21'),
            assignedAt: new Date(),
            trainerId: new Types.ObjectId(mockTrainerProfileId),
          },
        ],
      };

      const nextPlan = {
        ...mockPlan,
        _id: nextPlanId,
        weeklyCost: 0,
      };

      const finalClient = {
        ...client,
        currentPlanId: nextPlanId,
        balance: 10,
        monthlyBalance: 5,
      };

      clientsService.getProfileById
        .mockResolvedValueOnce(client as any)
        .mockResolvedValueOnce(finalClient as any);
      jest.spyOn(service, 'canUnlockNextWeek').mockResolvedValue(true);
      (planModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(nextPlan),
      });
      (clientModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(finalClient),
      });

      const result = await service.requestNextWeek(clientId);

      // Should find next plan (not future plan)
      expect(result.currentPlanId).toBe(nextPlanId.toString());
    });
  });
});

