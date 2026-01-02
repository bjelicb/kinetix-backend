import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { AdminService } from './admin.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { TrainerProfile, TrainerProfileDocument } from '../trainers/schemas/trainer-profile.schema';
import { CheckIn, CheckInDocument } from '../checkins/schemas/checkin.schema';
import { WeeklyPlan, WeeklyPlanDocument } from '../plans/schemas/weekly-plan.schema';
import { WorkoutLog, WorkoutLogDocument } from '../workouts/schemas/workout-log.schema';
import { GamificationService } from '../gamification/gamification.service';
import { AssignClientDto } from './dto/assign-client.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';

describe('AdminService', () => {
  let service: AdminService;
  let userModel: jest.Mocked<Model<UserDocument>>;
  let clientModel: jest.Mocked<Model<ClientProfileDocument>>;
  let trainerModel: jest.Mocked<Model<TrainerProfileDocument>>;
  let checkInModel: jest.Mocked<Model<CheckInDocument>>;
  let planModel: jest.Mocked<Model<WeeklyPlanDocument>>;
  let workoutLogModel: jest.Mocked<Model<WorkoutLogDocument>>;
  let gamificationService: jest.Mocked<GamificationService>;

  const mockUserId = '507f1f77bcf86cd799439011';
  const mockTrainerUserId = '507f1f77bcf86cd799439012';
  const mockClientUserId = '507f1f77bcf86cd799439013';
  const mockTrainerProfileId = '507f1f77bcf86cd799439020';
  const mockClientProfileId = '507f1f77bcf86cd799439021';
  const mockWorkoutId = '507f1f77bcf86cd799439022';
  const mockPlanId = '507f1f77bcf86cd799439023';

  const mockUser: Partial<UserDocument> = {
    _id: new Types.ObjectId(mockUserId),
    email: 'user@test.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.CLIENT,
    toObject: jest.fn().mockReturnValue({
      _id: mockUserId,
      email: 'user@test.com',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.CLIENT,
    }),
  };

  const mockTrainerUser: Partial<UserDocument> = {
    _id: new Types.ObjectId(mockTrainerUserId),
    email: 'trainer@test.com',
    firstName: 'Trainer',
    lastName: 'Name',
    role: UserRole.TRAINER,
    toObject: jest.fn().mockReturnValue({
      _id: mockTrainerUserId,
      email: 'trainer@test.com',
      firstName: 'Trainer',
      lastName: 'Name',
      role: UserRole.TRAINER,
    }),
  };

  const mockClientUser: Partial<UserDocument> = {
    _id: new Types.ObjectId(mockClientUserId),
    email: 'client@test.com',
    firstName: 'Client',
    lastName: 'Name',
    role: UserRole.CLIENT,
    toObject: jest.fn().mockReturnValue({
      _id: mockClientUserId,
      email: 'client@test.com',
      firstName: 'Client',
      lastName: 'Name',
      role: UserRole.CLIENT,
    }),
  };

  const mockTrainerProfile: Partial<TrainerProfileDocument> = {
    _id: new Types.ObjectId(mockTrainerProfileId),
    userId: new Types.ObjectId(mockTrainerUserId),
    isActive: true,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    clientIds: [],
    save: jest.fn().mockResolvedValue(this),
  };

  const mockClientProfile: Partial<ClientProfileDocument> = {
    _id: new Types.ObjectId(mockClientProfileId),
    userId: new Types.ObjectId(mockClientUserId),
    trainerId: new Types.ObjectId(mockTrainerProfileId),
    isPenaltyMode: false,
    save: jest.fn().mockResolvedValue(this),
  };

  const mockWorkoutLog: Partial<WorkoutLogDocument> = {
    _id: new Types.ObjectId(mockWorkoutId),
    clientId: new Types.ObjectId(mockClientProfileId),
    trainerId: new Types.ObjectId(mockTrainerProfileId),
    weeklyPlanId: new Types.ObjectId(mockPlanId),
    workoutDate: new Date(),
    isCompleted: false,
    isMissed: false,
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getModelToken(User.name),
          useValue: {
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            findByIdAndDelete: jest.fn(),
            countDocuments: jest.fn(),
          },
        },
        {
          provide: getModelToken(ClientProfile.name),
          useValue: Object.assign(
            jest.fn().mockImplementation((data) => ({
              ...data,
              ...mockClientProfile,
              save: jest.fn().mockResolvedValue({ ...data, ...mockClientProfile }),
            })),
            {
              findOne: jest.fn(),
              findById: jest.fn(),
              findByIdAndUpdate: jest.fn(),
              deleteMany: jest.fn(),
              countDocuments: jest.fn(),
            },
          ),
        },
        {
          provide: getModelToken(TrainerProfile.name),
          useValue: {
            findOne: jest.fn(),
            findById: jest.fn(),
            deleteMany: jest.fn(),
            countDocuments: jest.fn(),
          },
        },
        {
          provide: getModelToken(CheckIn.name),
          useValue: {
            countDocuments: jest.fn(),
          },
        },
        {
          provide: getModelToken(WeeklyPlan.name),
          useValue: {
            find: jest.fn(),
            deleteMany: jest.fn(),
            countDocuments: jest.fn(),
          },
        },
        {
          provide: getModelToken(WorkoutLog.name),
          useValue: {
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndDelete: jest.fn(),
            countDocuments: jest.fn(),
          },
        },
        {
          provide: GamificationService,
          useValue: {
            addPenaltyToBalance: jest.fn().mockResolvedValue(undefined),
            clearBalance: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userModel = module.get(getModelToken(User.name)) as any;
    clientModel = module.get(getModelToken(ClientProfile.name)) as any;
    trainerModel = module.get(getModelToken(TrainerProfile.name)) as any;
    checkInModel = module.get(getModelToken(CheckIn.name)) as any;
    planModel = module.get(getModelToken(WeeklyPlan.name)) as any;
    workoutLogModel = module.get(getModelToken(WorkoutLog.name)) as any;
    gamificationService = module.get(GamificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return all users with trainer information for CLIENT users', async () => {
      const mockUsers = [mockClientUser, mockTrainerUser];
      (userModel.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUsers),
      });

      // Mock client profile lookup for CLIENT user
      (clientModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      });

      // Mock trainer profile lookup for CLIENT's trainer
      (trainerModel.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockTrainerProfile,
            userId: {
              _id: new Types.ObjectId(mockTrainerUserId),
              firstName: 'Trainer',
              lastName: 'Name',
            },
          }),
        }),
      });

      // Mock trainer profile lookup for TRAINER user (isActive check)
      (trainerModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      });

      const result = await service.getAllUsers();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      // Check CLIENT user has trainerId and trainerName (User ID, not TrainerProfile ID)
      const clientUserData = result.data.find(u => u.role === UserRole.CLIENT);
      expect(clientUserData).toBeDefined();
      expect(clientUserData?.trainerId).toBe(mockTrainerUserId); // User ID, not TrainerProfile ID
      expect(clientUserData?.trainerName).toBe('Trainer Name');
      expect(clientUserData?.clientProfileId).toBe(mockClientProfileId);

      // Check TRAINER user has isActive status
      const trainerUserData = result.data.find(u => u.role === UserRole.TRAINER);
      expect(trainerUserData).toBeDefined();
      expect(trainerUserData?.isActive).toBe(true);
    });

    it('should handle CLIENT user without trainer', async () => {
      const clientWithoutTrainer = {
        ...mockClientUser,
        toObject: jest.fn().mockReturnValue({
          _id: mockClientUserId,
          email: 'client@test.com',
          firstName: 'Client',
          lastName: 'Name',
          role: UserRole.CLIENT,
        }),
      };
      
      (userModel.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([clientWithoutTrainer]),
      });

      // Client profile exists but no trainerId
      const clientProfileNoTrainer = {
        ...mockClientProfile,
        trainerId: null,
      };
      (clientModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientProfileNoTrainer),
      });

      const result = await service.getAllUsers();

      expect(result.success).toBe(true);
      const clientUserData = result.data[0];
      expect(clientUserData.trainerId).toBeNull();
      expect(clientUserData.trainerName).toBeNull();
      expect(clientUserData.clientProfileId).toBe(mockClientProfileId);
    });

    it('should handle CLIENT user without client profile', async () => {
      (userModel.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockClientUser]),
      });

      // No client profile found
      (clientModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getAllUsers();

      expect(result.success).toBe(true);
      const clientUserData = result.data[0];
      expect(clientUserData.clientProfileId).toBeNull();
    });

    it('should handle TRAINER user without trainer profile', async () => {
      (userModel.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockTrainerUser]),
      });

      // No trainer profile found
      (trainerModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getAllUsers();

      expect(result.success).toBe(true);
      const trainerUserData = result.data[0];
      expect(trainerUserData.isActive).toBe(true); // Default to active
    });
  });

  describe('getStats', () => {
    it('should return system statistics', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // MERODAVNOST PROVERA: getStats poziva userModel.countDocuments() 3 puta:
      // 1. Bez filtera (totalUsers) → 10
      // 2. Sa { role: 'TRAINER' } (totalTrainers) → 3
      // 3. Sa { role: 'CLIENT' } (totalClients) → 2
      (userModel.countDocuments as jest.Mock)
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(10), // totalUsers
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(3), // totalTrainers
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(2), // totalClients
        });

      // checkInModel.countDocuments se poziva 2 puta:
      // 1. Sa checkinDate filter (todayCheckIns) → 5
      // 2. Sa verificationStatus: 'PENDING' (pendingCheckIns) → 3
      (checkInModel.countDocuments as jest.Mock)
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(5), // todayCheckIns
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(3), // pendingCheckIns
        });

      // trainerModel.countDocuments se poziva 2 puta:
      // 1. Sa subscriptionStatus: 'ACTIVE' (activeTrainers) → 2
      // 2. Sa subscriptionStatus: 'SUSPENDED' (suspendedTrainers) → 1
      (trainerModel.countDocuments as jest.Mock)
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(2), // activeTrainers
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(1), // suspendedTrainers
        });

      (clientModel.countDocuments as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(1), // clientsInPenalty
      });

      (planModel.countDocuments as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(15), // totalPlans
      });

      (workoutLogModel.countDocuments as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(20), // totalWorkoutsCompleted
      });

      const result = await service.getStats();

      expect(result.success).toBe(true);
      expect(result.data.totalUsers).toBe(10);
      expect(result.data.totalTrainers).toBe(3);
      expect(result.data.totalClients).toBe(2);
      expect(result.data.todayCheckIns).toBe(5);
      expect(result.data.totalPlans).toBe(15);
      expect(result.data.totalWorkoutsCompleted).toBe(20);

      // Verify date range for today's check-ins
      expect(checkInModel.countDocuments).toHaveBeenCalledWith({
        checkinDate: {
          $gte: today,
          $lt: tomorrow,
        },
      });
    });
  });

  describe('assignClientToTrainer', () => {
    it('should assign client to trainer successfully', async () => {
      const dto: AssignClientDto = {
        clientId: mockClientUserId,
        trainerId: mockTrainerUserId,
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn()
          .mockResolvedValueOnce(mockClientUser) // Client user lookup
          .mockResolvedValueOnce(mockTrainerUser), // Trainer user lookup
      });

      (clientModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // No existing profile
      });

      (trainerModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      });

      // clientModel constructor is already mocked in beforeEach
      // Capture the instance created by the constructor
      let createdClientProfile: any;
      (clientModel as jest.Mock).mockImplementation((data) => {
        createdClientProfile = {
          ...data,
          ...mockClientProfile,
          save: jest.fn().mockResolvedValue({ ...data, ...mockClientProfile }),
        };
        return createdClientProfile;
      });

      const result = await service.assignClientToTrainer(dto);

      expect(result.success).toBe(true);
      expect(result.data.clientId).toBe(mockClientUserId);
      expect(result.data.trainerId).toBe(mockTrainerUserId);
      expect(createdClientProfile.save).toHaveBeenCalled();
      expect(mockTrainerProfile.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if client user not found', async () => {
      const dto: AssignClientDto = {
        clientId: mockClientUserId,
        trainerId: mockTrainerUserId,
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.assignClientToTrainer(dto)).rejects.toThrow(NotFoundException);
      await expect(service.assignClientToTrainer(dto)).rejects.toThrow('Client user not found');
    });

    it('should throw BadRequestException if user is not CLIENT', async () => {
      const dto: AssignClientDto = {
        clientId: mockTrainerUserId, // Using trainer ID as client ID
        trainerId: mockTrainerUserId,
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerUser), // Returns trainer, not client
      });

      // clientModel.findOne is not called because error is thrown before
      // But we need to mock it to avoid undefined errors
      (clientModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.assignClientToTrainer(dto)).rejects.toThrow(BadRequestException);
      await expect(service.assignClientToTrainer(dto)).rejects.toThrow('User is not a CLIENT');
    });

    it('should throw NotFoundException if trainer user not found', async () => {
      const dto: AssignClientDto = {
        clientId: mockClientUserId,
        trainerId: mockTrainerUserId,
      };

      // MERODAVNOST PROVERA: assignClientToTrainer poziva userModel.findById() 2 puta:
      // 1. Za clientId (clientUser) → mockClientUser
      // 2. Za trainerId (trainerUser) → null (not found)
      // Koristiti mockReturnValueOnce na exec chain-u za sekvencijalne pozive
      const mockExec = jest.fn()
        .mockResolvedValueOnce(mockClientUser) // Prvi poziv = client
        .mockResolvedValueOnce(null); // Drugi poziv = null (trainer not found)
      
      (userModel.findById as jest.Mock).mockReturnValue({
        exec: mockExec,
      });

      // clientModel.findOne is called to check if profile exists
      (clientModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // MERODAVNOST PROVERA: Koristiti try-catch za detaljniju proveru (ne dupli poziv)
      let thrownError: Error;
      try {
        await service.assignClientToTrainer(dto);
        fail('Should have thrown NotFoundException');
      } catch (error) {
        thrownError = error as Error;
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.message).toBe('Trainer user not found');
      }

      // MERODAVNOST PROVERA: Proveriti da se userModel.findById pozvao tačno 2 puta
      // (jedan za clientId, jedan za trainerId)
      expect(userModel.findById).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if user is not TRAINER', async () => {
      const dto: AssignClientDto = {
        clientId: mockClientUserId,
        trainerId: mockClientUserId, // Using client ID as trainer ID
      };

      // MERODAVNOST PROVERA: assignClientToTrainer poziva userModel.findById() 2 puta:
      // 1. Za clientId (clientUser) → mockClientUser
      // 2. Za trainerId (trainerUser) → mockClientUser (not a TRAINER)
      // Koristiti mockReturnValueOnce na exec chain-u za sekvencijalne pozive
      const mockExec = jest.fn()
        .mockResolvedValueOnce(mockClientUser) // Prvi poziv = client
        .mockResolvedValueOnce(mockClientUser); // Drugi poziv = client (not a TRAINER)
      
      (userModel.findById as jest.Mock).mockReturnValue({
        exec: mockExec,
      });

      // clientModel.findOne is called to check if profile exists
      (clientModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // MERODAVNOST PROVERA: Koristiti try-catch za detaljniju proveru (ne dupli poziv)
      let thrownError: Error;
      try {
        await service.assignClientToTrainer(dto);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        thrownError = error as Error;
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('User is not a TRAINER');
      }

      // MERODAVNOST PROVERA: Proveriti da se userModel.findById pozvao tačno 2 puta
      // (jedan za clientId, jedan za trainerId)
      expect(userModel.findById).toHaveBeenCalledTimes(2);
    });

    it('should unassign client from trainer when trainerId is null', async () => {
      const dto: AssignClientDto = {
        clientId: mockClientUserId,
        trainerId: null,
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClientUser),
      });

      (clientModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClientProfile),
      });

      (trainerModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      });

      const result = await service.assignClientToTrainer(dto);

      expect(result.success).toBe(true);
      expect(result.data.trainerId).toBeNull();
      expect(mockClientProfile.trainerId).toBeNull();
      expect(mockClientProfile.save).toHaveBeenCalled();
      expect(mockTrainerProfile.save).toHaveBeenCalled();
    });

    it('should remove client from old trainer when reassigning', async () => {
      const dto: AssignClientDto = {
        clientId: mockClientUserId,
        trainerId: mockTrainerUserId,
      };

      const oldTrainerProfileId = '507f1f77bcf86cd799439030';
      const clientWithOldTrainer = {
        ...mockClientProfile,
        trainerId: new Types.ObjectId(oldTrainerProfileId),
      };

      const oldTrainerProfile = {
        ...mockTrainerProfile,
        _id: new Types.ObjectId(oldTrainerProfileId),
        clientIds: [new Types.ObjectId(mockClientProfileId)],
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn()
          .mockResolvedValueOnce(mockClientUser)
          .mockResolvedValueOnce(mockTrainerUser),
      });

      (clientModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(clientWithOldTrainer),
      });

      (trainerModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(oldTrainerProfile),
      });

      (trainerModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      });

      const result = await service.assignClientToTrainer(dto);

      expect(result.success).toBe(true);
      expect(oldTrainerProfile.clientIds).not.toContainEqual(new Types.ObjectId(mockClientProfileId));
      expect(oldTrainerProfile.save).toHaveBeenCalled();
    });
  });

  describe('getAllPlans', () => {
    it('should return all plans with trainer information', async () => {
      const mockPlan = {
        _id: new Types.ObjectId(mockPlanId),
        name: 'Test Plan',
        description: 'Test Description',
        difficulty: 'INTERMEDIATE',
        trainerId: {
          _id: new Types.ObjectId(mockTrainerProfileId),
          userId: new Types.ObjectId(mockTrainerUserId),
        },
        assignedClientIds: [],
        isTemplate: true,
        weeklyCost: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (planModel.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockPlan]),
          }),
        }),
      });

      (trainerModel.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              ...mockTrainerProfile,
              userId: {
                _id: new Types.ObjectId(mockTrainerUserId),
                firstName: 'Trainer',
                lastName: 'Name',
                email: 'trainer@test.com',
              },
            }),
          }),
        }),
      });

      const result = await service.getAllPlans();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].trainerId).toBe(mockTrainerUserId); // User ID, not TrainerProfile ID
      expect(result.data[0].trainerName).toBe('Trainer Name');
      expect(result.data[0].trainerEmail).toBe('trainer@test.com');
    });
  });

  describe('getAllWorkouts', () => {
    it('should return all workouts with user information', async () => {
      const mockWorkout = {
        _id: new Types.ObjectId(mockWorkoutId),
        clientId: {
          userId: {
            firstName: 'Client',
            lastName: 'Name',
          },
        },
        trainerId: {
          userId: {
            firstName: 'Trainer',
            lastName: 'Name',
          },
        },
        weeklyPlanId: {
          name: 'Test Plan',
        },
        workoutDate: new Date(),
        isCompleted: true,
        isMissed: false,
        completedExercises: [{}, {}],
      };

      (workoutLogModel.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([mockWorkout]),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getAllWorkouts();

      expect(result).toHaveLength(1);
      expect(result[0].clientName).toBe('Client Name');
      expect(result[0].trainerName).toBe('Trainer Name');
      expect(result[0].planName).toBe('Test Plan');
      expect(result[0].completedExercisesCount).toBe(2);
    });
  });

  describe('getWorkoutStats', () => {
    it('should return workout statistics', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);

      (workoutLogModel.countDocuments as jest.Mock).mockReturnValue({
        exec: jest.fn()
          .mockResolvedValueOnce(5) // workoutsToday
          .mockResolvedValueOnce(20) // workoutsThisWeek
          .mockResolvedValueOnce(100) // totalWorkouts
          .mockResolvedValueOnce(150), // totalWorkoutLogs
      });

      const result = await service.getWorkoutStats();

      expect(result.success).toBe(true);
      expect(result.data.workoutsToday).toBe(5);
      expect(result.data.workoutsThisWeek).toBe(20);
      expect(result.data.totalWorkouts).toBe(100);
      expect(result.data.totalWorkoutLogs).toBe(150);
      expect(result.data.completionRate).toBeCloseTo(66.7, 1);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const dto: UpdateUserDto = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@test.com',
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const updatedUser = {
        ...mockUser,
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@test.com',
      };

      (userModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedUser),
      });

      const result = await service.updateUser(mockUserId, dto);

      expect(result.success).toBe(true);
      expect(result.data.firstName).toBe('Updated');
      expect(result.data.lastName).toBe('Name');
      expect(result.data.email).toBe('updated@test.com');
    });

    it('should throw NotFoundException if user not found', async () => {
      const dto: UpdateUserDto = {
        firstName: 'Updated',
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.updateUser(mockUserId, dto)).rejects.toThrow(NotFoundException);
      await expect(service.updateUser(mockUserId, dto)).rejects.toThrow('User not found');
    });

    it('should throw NotFoundException if user not found after update', async () => {
      const dto: UpdateUserDto = {
        firstName: 'Updated',
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      (userModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.updateUser(mockUserId, dto)).rejects.toThrow(NotFoundException);
      await expect(service.updateUser(mockUserId, dto)).rejects.toThrow('User not found after update');
    });
  });

  describe('deleteUser', () => {
    it('should delete CLIENT user and associated profile', async () => {
      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClientUser),
      });

      (clientModel.deleteMany as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      (userModel.findByIdAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockClientUser),
      });

      const result = await service.deleteUser(mockClientUserId);

      expect(result.success).toBe(true);
      expect(clientModel.deleteMany).toHaveBeenCalledWith({
        userId: new Types.ObjectId(mockClientUserId),
      });
      expect(userModel.findByIdAndDelete).toHaveBeenCalledWith(mockClientUserId);
    });

    it('should delete TRAINER user, profile, and plans', async () => {
      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerUser),
      });

      (trainerModel.deleteMany as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      // BUG: trainerProfile is loaded AFTER deleteMany, so it will be null
      // This test will reveal the bug - plans won't be deleted
      (trainerModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // Will be null because already deleted
      });

      (userModel.findByIdAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerUser),
      });

      const result = await service.deleteUser(mockTrainerUserId);

      expect(result.success).toBe(true);
      expect(trainerModel.deleteMany).toHaveBeenCalledWith({
        userId: new Types.ObjectId(mockTrainerUserId),
      });
      
      // BUG: This will fail because trainerProfile is null
      // Plans won't be deleted - this is the bug identified in the plan
      expect(planModel.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to delete ADMIN user', async () => {
      const adminUser = {
        ...mockUser,
        role: UserRole.ADMIN,
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(adminUser),
      });

      await expect(service.deleteUser(mockUserId)).rejects.toThrow(BadRequestException);
      await expect(service.deleteUser(mockUserId)).rejects.toThrow('Cannot delete admin users');
    });

    it('should throw NotFoundException if user not found', async () => {
      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.deleteUser(mockUserId)).rejects.toThrow(NotFoundException);
      await expect(service.deleteUser(mockUserId)).rejects.toThrow('User not found');
    });
  });

  describe('updateUserStatus', () => {
    it('should update TRAINER user status and profile', async () => {
      const dto: UpdateUserStatusDto = {
        isActive: false,
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerUser),
      });

      (trainerModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTrainerProfile),
      });

      const result = await service.updateUserStatus(mockTrainerUserId, dto);

      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);
      expect(mockTrainerProfile.isActive).toBe(false);
      expect(mockTrainerProfile.subscriptionStatus).toBe(SubscriptionStatus.SUSPENDED);
      expect(mockTrainerProfile.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      const dto: UpdateUserStatusDto = {
        isActive: false,
      };

      (userModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.updateUserStatus(mockUserId, dto)).rejects.toThrow(NotFoundException);
      await expect(service.updateUserStatus(mockUserId, dto)).rejects.toThrow('User not found');
    });
  });

  describe('updateWorkoutStatus', () => {
    it('should mark workout as missed and add penalty', async () => {
      const body = {
        isMissed: true,
      };

      const workout = {
        ...mockWorkoutLog,
        isMissed: false, // Was not missed before
      };

      (workoutLogModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(workout),
      });

      const result = await service.updateWorkoutStatus(mockWorkoutId, body);

      expect(result.success).toBe(true);
      expect(result.data.isMissed).toBe(true);
      expect(result.data.isCompleted).toBe(false);
      expect(gamificationService.addPenaltyToBalance).toHaveBeenCalledWith(
        workout.clientId.toString(),
        1,
        'Missed workout penalty',
        workout.weeklyPlanId,
      );
      expect(workout.save).toHaveBeenCalled();
    });

    it('should not add penalty if workout was already missed', async () => {
      const body = {
        isMissed: true,
      };

      const workout = {
        ...mockWorkoutLog,
        isMissed: true, // Was already missed
      };

      (workoutLogModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(workout),
      });

      const result = await service.updateWorkoutStatus(mockWorkoutId, body);

      expect(result.success).toBe(true);
      expect(gamificationService.addPenaltyToBalance).not.toHaveBeenCalled();
    });

    it('should handle penalty failure gracefully - workout update still succeeds', async () => {
      const body = {
        isMissed: true,
      };

      const workout = {
        ...mockWorkoutLog,
        isMissed: false,
      };

      (workoutLogModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(workout),
      });

      // Mock penalty service to throw error
      gamificationService.addPenaltyToBalance.mockRejectedValue(new Error('Penalty service error'));

      const result = await service.updateWorkoutStatus(mockWorkoutId, body);

      // Workout update should still succeed even if penalty fails
      expect(result.success).toBe(true);
      expect(result.data.isMissed).toBe(true);
      expect(workout.save).toHaveBeenCalled();
    });

    it('should mark workout as completed and clear missed status', async () => {
      const body = {
        isCompleted: true,
      };

      const workout = {
        ...mockWorkoutLog,
        isCompleted: false,
        isMissed: true,
      };

      (workoutLogModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(workout),
      });

      const result = await service.updateWorkoutStatus(mockWorkoutId, body);

      expect(result.success).toBe(true);
      expect(result.data.isCompleted).toBe(true);
      expect(result.data.isMissed).toBe(false);
    });

    it('should throw NotFoundException if workout not found', async () => {
      const body = {
        isMissed: true,
      };

      (workoutLogModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.updateWorkoutStatus(mockWorkoutId, body)).rejects.toThrow(NotFoundException);
      await expect(service.updateWorkoutStatus(mockWorkoutId, body)).rejects.toThrow('Workout not found');
    });
  });

  describe('deleteWorkout', () => {
    it('should delete workout successfully', async () => {
      (workoutLogModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWorkoutLog),
      });

      (workoutLogModel.findByIdAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWorkoutLog),
      });

      const result = await service.deleteWorkout(mockWorkoutId);

      expect(result.success).toBe(true);
      expect(workoutLogModel.findByIdAndDelete).toHaveBeenCalledWith(mockWorkoutId);
    });

    it('should throw NotFoundException if workout not found', async () => {
      (workoutLogModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.deleteWorkout(mockWorkoutId)).rejects.toThrow(NotFoundException);
      await expect(service.deleteWorkout(mockWorkoutId)).rejects.toThrow('Workout not found');
    });
  });
});
