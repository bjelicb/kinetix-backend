import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AssignClientDto } from './dto/assign-client.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: jest.Mocked<AdminService>;

  const mockAdminService = {
    getAllUsers: jest.fn(),
    getStats: jest.fn(),
    assignClientToTrainer: jest.fn(),
    getAllPlans: jest.fn(),
    getAllWorkouts: jest.fn(),
    getWorkoutStats: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    updateUserStatus: jest.fn(),
    updateWorkoutStatus: jest.fn(),
    deleteWorkout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should call adminService.getAllUsers() and return response', async () => {
      // MERODAVNOST: Proverava da se service poziva i da response ima ispravan format
      const mockResponse = {
        success: true,
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            email: 'user1@test.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'CLIENT',
            trainerId: '507f1f77bcf86cd799439012',
            trainerName: 'Trainer Name',
            clientProfileId: '507f1f77bcf86cd799439013',
            isActive: true,
          },
        ],
      };

      adminService.getAllUsers.mockResolvedValue(mockResponse);

      const result = await controller.getAllUsers();

      expect(adminService.getAllUsers).toHaveBeenCalledTimes(1);
      expect(adminService.getAllUsers).toHaveBeenCalledWith();
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should call adminService.getStats() and return response', async () => {
      // MERODAVNOST: Proverava da se service poziva i da response ima ispravan format
      const mockResponse = {
        success: true,
        data: {
          totalUsers: 100,
          totalTrainers: 10,
          totalClients: 90,
          todayCheckIns: 5,
          activeTrainers: 8,
          suspendedTrainers: 2,
          clientsInPenalty: 3,
          totalPlans: 50,
          totalWorkoutsCompleted: 200,
          pendingCheckIns: 1,
        },
      };

      adminService.getStats.mockResolvedValue(mockResponse);

      const result = await controller.getStats();

      expect(adminService.getStats).toHaveBeenCalledTimes(1);
      expect(adminService.getStats).toHaveBeenCalledWith();
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.totalUsers).toBe('number');
    });
  });

  describe('assignClient', () => {
    it('should call adminService.assignClientToTrainer() with valid DTO and return response', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim DTO parametrima
      const dto: AssignClientDto = {
        clientId: '507f1f77bcf86cd799439011',
        trainerId: '507f1f77bcf86cd799439012',
      };

      const mockResponse = {
        success: true,
        data: {
          clientId: dto.clientId,
          trainerId: dto.trainerId,
          message: 'Client assigned to trainer successfully',
        },
      };

      adminService.assignClientToTrainer.mockResolvedValue(mockResponse);

      const result = await controller.assignClient(dto);

      expect(adminService.assignClientToTrainer).toHaveBeenCalledTimes(1);
      expect(adminService.assignClientToTrainer).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.data.clientId).toBe(dto.clientId);
      expect(result.data.trainerId).toBe(dto.trainerId);
    });

    it('should call adminService.assignClientToTrainer() with unassign DTO (trainerId = null)', async () => {
      // MERODAVNOST: Proverava da se service poziva sa null trainerId za unassign
      const dto: AssignClientDto = {
        clientId: '507f1f77bcf86cd799439011',
        trainerId: null,
      };

      const mockResponse = {
        success: true,
        data: {
          clientId: dto.clientId,
          trainerId: null,
          message: 'Client unassigned from trainer successfully',
        },
      };

      adminService.assignClientToTrainer.mockResolvedValue(mockResponse);

      const result = await controller.assignClient(dto);

      expect(adminService.assignClientToTrainer).toHaveBeenCalledTimes(1);
      expect(adminService.assignClientToTrainer).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
      expect(result.data.trainerId).toBeNull();
    });

    it('should call adminService.assignClientToTrainer() with unassign DTO (trainerId = empty string)', async () => {
      // MERODAVNOST: Proverava da se service poziva sa empty string trainerId za unassign
      const dto: AssignClientDto = {
        clientId: '507f1f77bcf86cd799439011',
        trainerId: '',
      };

      const mockResponse = {
        success: true,
        data: {
          clientId: dto.clientId,
          trainerId: null,
          message: 'Client unassigned from trainer successfully',
        },
      };

      adminService.assignClientToTrainer.mockResolvedValue(mockResponse);

      const result = await controller.assignClient(dto);

      expect(adminService.assignClientToTrainer).toHaveBeenCalledTimes(1);
      expect(adminService.assignClientToTrainer).toHaveBeenCalledWith(dto);
      expect(result.data.trainerId).toBeNull();
    });

    it('should propagate NotFoundException from service', async () => {
      // MERODAVNOST: Proverava da controller prosleđuje service error
      const dto: AssignClientDto = {
        clientId: '507f1f77bcf86cd799439011',
        trainerId: '507f1f77bcf86cd799439012',
      };

      adminService.assignClientToTrainer.mockRejectedValue(
        new NotFoundException('Client user not found'),
      );

      await expect(controller.assignClient(dto)).rejects.toThrow(NotFoundException);
      expect(adminService.assignClientToTrainer).toHaveBeenCalledWith(dto);
    });

    it('should propagate BadRequestException from service', async () => {
      // MERODAVNOST: Proverava da controller prosleđuje service error
      const dto: AssignClientDto = {
        clientId: '507f1f77bcf86cd799439011',
        trainerId: '507f1f77bcf86cd799439012',
      };

      adminService.assignClientToTrainer.mockRejectedValue(
        new BadRequestException('User is not a CLIENT'),
      );

      await expect(controller.assignClient(dto)).rejects.toThrow(BadRequestException);
      expect(adminService.assignClientToTrainer).toHaveBeenCalledWith(dto);
    });
  });

  describe('getAllPlans', () => {
    it('should call adminService.getAllPlans() and return response', async () => {
      // MERODAVNOST: Proverava da se service poziva i da response ima ispravan format
      const mockResponse = {
        success: true,
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            name: 'Test Plan',
            description: 'Test Description',
            difficulty: 'BEGINNER',
            trainerId: '507f1f77bcf86cd799439012',
            trainerProfileId: '507f1f77bcf86cd799439013',
            trainerName: 'Trainer Name',
            trainerEmail: 'trainer@test.com',
            assignedClientCount: 5,
            isTemplate: false,
            weeklyCost: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      adminService.getAllPlans.mockResolvedValue(mockResponse);

      const result = await controller.getAllPlans();

      expect(adminService.getAllPlans).toHaveBeenCalledTimes(1);
      expect(adminService.getAllPlans).toHaveBeenCalledWith();
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('getAllWorkouts', () => {
    it('should call adminService.getAllWorkouts() and return response', async () => {
      // MERODAVNOST: Proverava da se service poziva i da response ima ispravan format
      const mockResponse = [
        {
          _id: '507f1f77bcf86cd799439011',
          clientName: 'Client Name',
          trainerName: 'Trainer Name',
          workoutDate: new Date(),
          isCompleted: true,
          isMissed: false,
          planName: 'Test Plan',
          completedExercisesCount: 5,
        },
      ];

      adminService.getAllWorkouts.mockResolvedValue(mockResponse);

      const result = await controller.getAllWorkouts();

      expect(adminService.getAllWorkouts).toHaveBeenCalledTimes(1);
      expect(adminService.getAllWorkouts).toHaveBeenCalledWith();
      expect(result).toEqual(mockResponse);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getWorkoutStats', () => {
    it('should call adminService.getWorkoutStats() and return response', async () => {
      // MERODAVNOST: Proverava da se service poziva i da response ima ispravan format
      const mockResponse = {
        success: true,
        data: {
          workoutsToday: 10,
          workoutsThisWeek: 50,
          totalWorkouts: 200,
          totalWorkoutLogs: 250,
          completionRate: 80.0,
        },
      };

      adminService.getWorkoutStats.mockResolvedValue(mockResponse);

      const result = await controller.getWorkoutStats();

      expect(adminService.getWorkoutStats).toHaveBeenCalledTimes(1);
      expect(adminService.getWorkoutStats).toHaveBeenCalledWith();
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.completionRate).toBe('number');
    });
  });

  describe('updateUser', () => {
    it('should call adminService.updateUser() with id and DTO containing firstName', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateUserDto = {
        firstName: 'Updated First Name',
      };

      const mockResponse = {
        success: true,
        data: {
          _id: userId,
          email: 'user@test.com',
          firstName: dto.firstName,
          lastName: 'Doe',
          role: 'CLIENT',
        },
      };

      adminService.updateUser.mockResolvedValue(mockResponse);

      const result = await controller.updateUser(userId, dto);

      expect(adminService.updateUser).toHaveBeenCalledTimes(1);
      expect(adminService.updateUser).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(mockResponse);
      expect(result.data.firstName).toBe(dto.firstName);
    });

    it('should call adminService.updateUser() with id and DTO containing lastName', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateUserDto = {
        lastName: 'Updated Last Name',
      };

      const mockResponse = {
        success: true,
        data: {
          _id: userId,
          email: 'user@test.com',
          firstName: 'John',
          lastName: dto.lastName,
          role: 'CLIENT',
        },
      };

      adminService.updateUser.mockResolvedValue(mockResponse);

      const result = await controller.updateUser(userId, dto);

      expect(adminService.updateUser).toHaveBeenCalledWith(userId, dto);
      expect(result.data.lastName).toBe(dto.lastName);
    });

    it('should call adminService.updateUser() with id and DTO containing email', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateUserDto = {
        email: 'updated@test.com',
      };

      const mockResponse = {
        success: true,
        data: {
          _id: userId,
          email: dto.email,
          firstName: 'John',
          lastName: 'Doe',
          role: 'CLIENT',
        },
      };

      adminService.updateUser.mockResolvedValue(mockResponse);

      const result = await controller.updateUser(userId, dto);

      expect(adminService.updateUser).toHaveBeenCalledWith(userId, dto);
      expect(result.data.email).toBe(dto.email);
    });

    it('should call adminService.updateUser() with id and DTO containing role', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateUserDto = {
        role: 'TRAINER' as any,
      };

      const mockResponse = {
        success: true,
        data: {
          _id: userId,
          email: 'user@test.com',
          firstName: 'John',
          lastName: 'Doe',
          role: dto.role,
        },
      };

      adminService.updateUser.mockResolvedValue(mockResponse);

      const result = await controller.updateUser(userId, dto);

      expect(adminService.updateUser).toHaveBeenCalledWith(userId, dto);
      expect(result.data.role).toBe(dto.role);
    });

    it('should call adminService.updateUser() with id and DTO containing multiple fields', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima (kombinovani DTO)
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateUserDto = {
        firstName: 'Updated First',
        lastName: 'Updated Last',
        email: 'updated@test.com',
        role: 'TRAINER' as any,
      };

      const mockResponse = {
        success: true,
        data: {
          _id: userId,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
        },
      };

      adminService.updateUser.mockResolvedValue(mockResponse);

      const result = await controller.updateUser(userId, dto);

      expect(adminService.updateUser).toHaveBeenCalledWith(userId, dto);
      expect(result.data.firstName).toBe(dto.firstName);
      expect(result.data.lastName).toBe(dto.lastName);
      expect(result.data.email).toBe(dto.email);
      expect(result.data.role).toBe(dto.role);
    });

    it('should propagate NotFoundException from service', async () => {
      // MERODAVNOST: Proverava da controller prosleđuje service error
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateUserDto = {
        firstName: 'Updated',
      };

      adminService.updateUser.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.updateUser(userId, dto)).rejects.toThrow(NotFoundException);
      expect(adminService.updateUser).toHaveBeenCalledWith(userId, dto);
    });
  });

  describe('deleteUser', () => {
    it('should call adminService.deleteUser() with id and return response', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim id parametrom
      const userId = '507f1f77bcf86cd799439011';

      const mockResponse = {
        success: true,
        message: 'User deleted successfully',
      };

      adminService.deleteUser.mockResolvedValue(mockResponse);

      const result = await controller.deleteUser(userId);

      expect(adminService.deleteUser).toHaveBeenCalledTimes(1);
      expect(adminService.deleteUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.message).toBe('User deleted successfully');
    });

    it('should propagate NotFoundException from service', async () => {
      // MERODAVNOST: Proverava da controller prosleđuje service error
      const userId = '507f1f77bcf86cd799439011';

      adminService.deleteUser.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.deleteUser(userId)).rejects.toThrow(NotFoundException);
      expect(adminService.deleteUser).toHaveBeenCalledWith(userId);
    });

    it('should propagate BadRequestException from service (cannot delete admin)', async () => {
      // MERODAVNOST: Proverava da controller prosleđuje service error
      const userId = '507f1f77bcf86cd799439011';

      adminService.deleteUser.mockRejectedValue(
        new BadRequestException('Cannot delete admin users'),
      );

      await expect(controller.deleteUser(userId)).rejects.toThrow(BadRequestException);
      expect(adminService.deleteUser).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateUserStatus', () => {
    it('should call adminService.updateUserStatus() with id and DTO (isActive: true)', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateUserStatusDto = {
        isActive: true,
      };

      const mockResponse = {
        success: true,
        data: {
          userId,
          isActive: dto.isActive,
        },
      };

      adminService.updateUserStatus.mockResolvedValue(mockResponse);

      const result = await controller.updateUserStatus(userId, dto);

      expect(adminService.updateUserStatus).toHaveBeenCalledTimes(1);
      expect(adminService.updateUserStatus).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(mockResponse);
      expect(result.data.isActive).toBe(true);
    });

    it('should call adminService.updateUserStatus() with id and DTO (isActive: false)', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateUserStatusDto = {
        isActive: false,
      };

      const mockResponse = {
        success: true,
        data: {
          userId,
          isActive: dto.isActive,
        },
      };

      adminService.updateUserStatus.mockResolvedValue(mockResponse);

      const result = await controller.updateUserStatus(userId, dto);

      expect(adminService.updateUserStatus).toHaveBeenCalledWith(userId, dto);
      expect(result.data.isActive).toBe(false);
    });

    it('should propagate NotFoundException from service', async () => {
      // MERODAVNOST: Proverava da controller prosleđuje service error
      const userId = '507f1f77bcf86cd799439011';
      const dto: UpdateUserStatusDto = {
        isActive: true,
      };

      adminService.updateUserStatus.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.updateUserStatus(userId, dto)).rejects.toThrow(NotFoundException);
      expect(adminService.updateUserStatus).toHaveBeenCalledWith(userId, dto);
    });
  });

  describe('updateWorkoutStatus', () => {
    it('should call adminService.updateWorkoutStatus() with id and body (isCompleted: true)', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima
      const workoutId = '507f1f77bcf86cd799439011';
      const body = {
        isCompleted: true,
      };

      const mockResponse = {
        success: true,
        data: {
          _id: workoutId,
          isCompleted: body.isCompleted,
          isMissed: false,
        },
      };

      adminService.updateWorkoutStatus.mockResolvedValue(mockResponse);

      const result = await controller.updateWorkoutStatus(workoutId, body);

      expect(adminService.updateWorkoutStatus).toHaveBeenCalledTimes(1);
      expect(adminService.updateWorkoutStatus).toHaveBeenCalledWith(workoutId, body);
      expect(result).toEqual(mockResponse);
      expect(result.data.isCompleted).toBe(true);
    });

    it('should call adminService.updateWorkoutStatus() with id and body (isMissed: true)', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima
      const workoutId = '507f1f77bcf86cd799439011';
      const body = {
        isMissed: true,
      };

      const mockResponse = {
        success: true,
        data: {
          _id: workoutId,
          isCompleted: false,
          isMissed: body.isMissed,
        },
      };

      adminService.updateWorkoutStatus.mockResolvedValue(mockResponse);

      const result = await controller.updateWorkoutStatus(workoutId, body);

      expect(adminService.updateWorkoutStatus).toHaveBeenCalledWith(workoutId, body);
      expect(result.data.isMissed).toBe(true);
    });

    it('should call adminService.updateWorkoutStatus() with id and body (both isCompleted and isMissed)', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim parametrima (kombinovani body)
      const workoutId = '507f1f77bcf86cd799439011';
      const body = {
        isCompleted: true,
        isMissed: false,
      };

      const mockResponse = {
        success: true,
        data: {
          _id: workoutId,
          isCompleted: body.isCompleted,
          isMissed: body.isMissed,
        },
      };

      adminService.updateWorkoutStatus.mockResolvedValue(mockResponse);

      const result = await controller.updateWorkoutStatus(workoutId, body);

      expect(adminService.updateWorkoutStatus).toHaveBeenCalledWith(workoutId, body);
      expect(result.data.isCompleted).toBe(true);
      expect(result.data.isMissed).toBe(false);
    });

    it('should propagate NotFoundException from service', async () => {
      // MERODAVNOST: Proverava da controller prosleđuje service error
      const workoutId = '507f1f77bcf86cd799439011';
      const body = {
        isCompleted: true,
      };

      adminService.updateWorkoutStatus.mockRejectedValue(
        new NotFoundException('Workout not found'),
      );

      await expect(controller.updateWorkoutStatus(workoutId, body)).rejects.toThrow(
        NotFoundException,
      );
      expect(adminService.updateWorkoutStatus).toHaveBeenCalledWith(workoutId, body);
    });
  });

  describe('deleteWorkout', () => {
    it('should call adminService.deleteWorkout() with id and return response', async () => {
      // MERODAVNOST: Proverava da se service poziva sa ispravnim id parametrom
      const workoutId = '507f1f77bcf86cd799439011';

      const mockResponse = {
        success: true,
        message: 'Workout deleted successfully',
      };

      adminService.deleteWorkout.mockResolvedValue(mockResponse);

      const result = await controller.deleteWorkout(workoutId);

      expect(adminService.deleteWorkout).toHaveBeenCalledTimes(1);
      expect(adminService.deleteWorkout).toHaveBeenCalledWith(workoutId);
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Workout deleted successfully');
    });

    it('should propagate NotFoundException from service', async () => {
      // MERODAVNOST: Proverava da controller prosleđuje service error
      const workoutId = '507f1f77bcf86cd799439011';

      adminService.deleteWorkout.mockRejectedValue(new NotFoundException('Workout not found'));

      await expect(controller.deleteWorkout(workoutId)).rejects.toThrow(NotFoundException);
      expect(adminService.deleteWorkout).toHaveBeenCalledWith(workoutId);
    });
  });
});
