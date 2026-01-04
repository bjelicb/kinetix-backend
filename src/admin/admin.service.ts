import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { TrainerProfile, TrainerProfileDocument } from '../trainers/schemas/trainer-profile.schema';
import { CheckIn, CheckInDocument } from '../checkins/schemas/checkin.schema';
import { WeeklyPlan, WeeklyPlanDocument } from '../plans/schemas/weekly-plan.schema';
import { WorkoutLog, WorkoutLogDocument } from '../workouts/schemas/workout-log.schema';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import { AssignClientDto } from './dto/assign-client.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { GamificationService } from '../gamification/gamification.service';
import { AppLogger } from '../common/utils/logger.utils';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ClientProfile.name) private clientModel: Model<ClientProfileDocument>,
    @InjectModel(TrainerProfile.name) private trainerModel: Model<TrainerProfileDocument>,
    @InjectModel(CheckIn.name) private checkInModel: Model<CheckInDocument>,
    @InjectModel(WeeklyPlan.name) private planModel: Model<WeeklyPlanDocument>,
    @InjectModel(WorkoutLog.name) private workoutLogModel: Model<WorkoutLogDocument>,
    private gamificationService: GamificationService,
  ) {}

  async getAllUsers() {
    AppLogger.logStart('ADMIN_GET_ALL_USERS', {});
    const users = await this.userModel.find().exec();
    AppLogger.logOperation('ADMIN_GET_ALL_USERS_FOUND', { count: users.length }, 'debug');

    const usersWithTrainerInfo = await Promise.all(
      users.map(async (user) => {
        let trainerId: string | null = null;
        let trainerName: string | null = null;
        let clientProfileId: string | null = null;

        // If user is a CLIENT, find their trainer and get clientProfileId
        if (user.role === 'CLIENT') {
          const clientProfile = await this.clientModel
            .findOne({ userId: user._id })
            .exec();

          if (clientProfile) {
            clientProfileId = clientProfile._id.toString();

            if (clientProfile.trainerId) {
              const trainerProfileId = (clientProfile.trainerId as any)?._id 
                ? (clientProfile.trainerId as any)._id 
                : clientProfile.trainerId;
              
              let trainerProfileFound = false;
              
              try {
                const trainerProfile = await this.trainerModel
                  .findById(trainerProfileId)
                  .populate('userId', 'firstName lastName')
                  .exec();

                if (trainerProfile && trainerProfile.userId) {
                  const trainerUser = trainerProfile.userId as any;
                  trainerName = `${trainerUser.firstName} ${trainerUser.lastName}`.trim();
                  trainerId = trainerUser._id.toString();
                  trainerProfileFound = true;
                }
              } catch (e) {}
              
              if (!trainerProfileFound) {
                try {
                  const trainerUser = await this.userModel.findById(trainerProfileId).exec();
                  if (trainerUser && trainerUser.role === 'TRAINER') {
                    trainerName = `${trainerUser.firstName} ${trainerUser.lastName}`.trim();
                    trainerId = trainerUser._id.toString();
                  }
                } catch (e) {}
              }
            }
          }
        }

        // Handle isActive and subscription info
        let isActive = true;
        let subscriptionStatus: string | null = null;
        let subscriptionExpiresAt: Date | null = null;

        if (user.role === 'TRAINER') {
          const trainerProfile = await this.trainerModel
            .findOne({ userId: user._id })
            .exec();

          if (trainerProfile) {
            isActive = trainerProfile.isActive;
            subscriptionStatus = trainerProfile.subscriptionStatus;
            subscriptionExpiresAt = trainerProfile.subscriptionExpiresAt;
            
            AppLogger.logOperation('ADMIN_GET_ALL_USERS_TRAINER_PROFILE', {
              userId: user._id.toString(),
              subscriptionExpiresAt: trainerProfile.subscriptionExpiresAt,
              subscriptionStatus: trainerProfile.subscriptionStatus,
            }, 'debug');
          }
        }

        return {
          _id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive,
          trainerId,
          trainerName,
          clientProfileId,
          subscriptionStatus,
          subscriptionExpiresAt,
        };
      }),
    );

    AppLogger.logComplete('ADMIN_GET_ALL_USERS', { count: usersWithTrainerInfo.length });
    return {
      success: true,
      data: usersWithTrainerInfo,
    };
  }

  async getStats() {
    AppLogger.logStart('ADMIN_GET_STATS', {});
    const totalUsers = await this.userModel.countDocuments().exec();
    const totalTrainers = await this.userModel.countDocuments({ role: 'TRAINER' }).exec();
    const totalClients = await this.userModel.countDocuments({ role: 'CLIENT' }).exec();
    AppLogger.logOperation('ADMIN_GET_STATS_COUNTS', { totalUsers, totalTrainers, totalClients }, 'debug');

    // Get today's check-ins count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCheckIns = await this.checkInModel
      .countDocuments({
        checkinDate: {
          $gte: today,
          $lt: tomorrow,
        },
      })
      .exec();

    // Enhanced stats
    const activeTrainers = await this.trainerModel.countDocuments({
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: { $gte: today },
    }).exec();

    const suspendedTrainers = await this.trainerModel.countDocuments({
      subscriptionStatus: 'SUSPENDED',
    }).exec();

    const clientsInPenalty = await this.clientModel.countDocuments({
      isPenaltyMode: true,
    }).exec();

    const totalPlans = await this.planModel.countDocuments().exec();

    const totalWorkoutsCompleted = await this.workoutLogModel.countDocuments({
      isCompleted: true,
    }).exec();

    const pendingCheckIns = await this.checkInModel.countDocuments({
      verificationStatus: 'PENDING',
    }).exec();

    AppLogger.logComplete('ADMIN_GET_STATS', { 
      totalUsers, 
      totalTrainers, 
      totalClients, 
      todayCheckIns, 
      activeTrainers, 
      suspendedTrainers, 
      clientsInPenalty, 
      totalPlans, 
      totalWorkoutsCompleted, 
      pendingCheckIns 
    });
    return {
      success: true,
      data: {
        totalUsers,
        totalTrainers,
        totalClients,
        todayCheckIns,
        activeTrainers,
        suspendedTrainers,
        clientsInPenalty,
        totalPlans,
        totalWorkoutsCompleted,
        pendingCheckIns,
      },
    };
  }

  async assignClientToTrainer(dto: AssignClientDto) {
    AppLogger.logStart('ADMIN_ASSIGN_CLIENT_TO_TRAINER', { 
      clientId: dto.clientId, 
      trainerId: dto.trainerId || 'null (unassign)' 
    });
    
    // Verify client user exists and is a CLIENT
    const clientUser = await this.userModel.findById(dto.clientId).exec();
    if (!clientUser) {
      AppLogger.logWarning('ADMIN_ASSIGN_CLIENT_CLIENT_NOT_FOUND', { clientId: dto.clientId });
      throw new NotFoundException('Client user not found');
    }
    if (clientUser.role !== 'CLIENT') {
      AppLogger.logWarning('ADMIN_ASSIGN_CLIENT_INVALID_ROLE', { clientId: dto.clientId, role: clientUser.role });
      throw new BadRequestException('User is not a CLIENT');
    }

    // Get or create client profile
    let clientProfile = await this.clientModel
      .findOne({ userId: new Types.ObjectId(dto.clientId) })
      .exec();

    // Handle unassign case (trainerId is null, undefined, or empty)
    if (!dto.trainerId || (typeof dto.trainerId === 'string' && dto.trainerId.trim() === '')) {
      if (clientProfile && clientProfile.trainerId) {
        // Remove client from old trainer's clientIds array
        const oldTrainerProfile = await this.trainerModel
          .findById(clientProfile.trainerId)
          .exec();
        
        if (oldTrainerProfile) {
          oldTrainerProfile.clientIds = oldTrainerProfile.clientIds.filter(
            (id) => !id.equals(clientProfile!._id)
          );
          await oldTrainerProfile.save();
          AppLogger.logOperation('ADMIN_ASSIGN_CLIENT_REMOVED_FROM_TRAINER', { 
            clientProfileId: clientProfile._id.toString() 
          }, 'debug');
        }
        
        // Remove trainerId from client profile
        clientProfile.trainerId = null as any;
        await clientProfile.save();
        AppLogger.logComplete('ADMIN_ASSIGN_CLIENT_UNASSIGN', { clientId: dto.clientId });
      }
      
      return {
        success: true,
        data: {
          clientId: dto.clientId,
          trainerId: null,
          message: 'Client unassigned from trainer successfully',
        },
      };
    }

    // Verify trainer user exists and is a TRAINER
    const trainerUser = await this.userModel.findById(dto.trainerId).exec();
    if (!trainerUser) {
      AppLogger.logWarning('ADMIN_ASSIGN_CLIENT_TRAINER_USER_NOT_FOUND', { trainerId: dto.trainerId });
      throw new NotFoundException('Trainer user not found');
    }
    if (trainerUser.role !== 'TRAINER') {
      AppLogger.logWarning('ADMIN_ASSIGN_CLIENT_INVALID_TRAINER_ROLE', { trainerId: dto.trainerId, role: trainerUser.role });
      throw new BadRequestException('User is not a TRAINER');
    }

    // Get trainer profile
    const trainerProfile = await this.trainerModel
      .findOne({ userId: new Types.ObjectId(dto.trainerId) })
      .exec();

    if (!trainerProfile) {
      AppLogger.logWarning('ADMIN_ASSIGN_CLIENT_TRAINER_PROFILE_NOT_FOUND', { trainerId: dto.trainerId });
      throw new NotFoundException('Trainer profile not found');
    }

    AppLogger.logOperation('ADMIN_ASSIGN_CLIENT_TRAINER_PROFILE_FOUND', { 
      trainerProfileId: trainerProfile._id.toString() 
    }, 'debug');

    // If client profile exists and has a different trainer, remove from old trainer
    if (clientProfile && clientProfile.trainerId) {
      const oldTrainerProfile = await this.trainerModel
        .findById(clientProfile.trainerId)
        .exec();
      
      if (oldTrainerProfile && !oldTrainerProfile._id.equals(trainerProfile._id)) {
        oldTrainerProfile.clientIds = oldTrainerProfile.clientIds.filter(
          (id) => !id.equals(clientProfile!._id)
        );
        await oldTrainerProfile.save();
        AppLogger.logOperation('ADMIN_ASSIGN_CLIENT_REMOVED_FROM_OLD_TRAINER', {}, 'debug');
      }
    }

    if (clientProfile) {
      // Update existing client profile
      AppLogger.logOperation('ADMIN_ASSIGN_CLIENT_UPDATING_PROFILE', { 
        clientProfileId: clientProfile._id.toString() 
      }, 'debug');
      clientProfile.trainerId = trainerProfile._id; // Use trainer profile ID, not user ID
      await clientProfile.save();
      AppLogger.logOperation('ADMIN_ASSIGN_CLIENT_PROFILE_UPDATED', { 
        clientProfileId: clientProfile._id.toString(), 
        trainerProfileId: trainerProfile._id.toString() 
      }, 'debug');
    } else {
      // Create new client profile
      AppLogger.logOperation('ADMIN_ASSIGN_CLIENT_CREATING_PROFILE', { 
        clientId: dto.clientId 
      }, 'debug');
      clientProfile = new this.clientModel({
        userId: new Types.ObjectId(dto.clientId),
        trainerId: trainerProfile._id, // Use trainer profile ID, not user ID
      });
      await clientProfile.save();
      AppLogger.logOperation('ADMIN_ASSIGN_CLIENT_PROFILE_CREATED', { 
        clientProfileId: clientProfile._id.toString() 
      }, 'debug');
    }

    // Update trainer's clientIds array
    if (!trainerProfile.clientIds.includes(clientProfile._id)) {
      trainerProfile.clientIds.push(clientProfile._id);
      await trainerProfile.save();
      AppLogger.logOperation('ADMIN_ASSIGN_CLIENT_ADDED_TO_TRAINER', { 
        clientProfileId: clientProfile._id.toString() 
      }, 'debug');
    } else {
      AppLogger.logOperation('ADMIN_ASSIGN_CLIENT_ALREADY_IN_TRAINER', { 
        clientProfileId: clientProfile._id.toString() 
      }, 'debug');
    }

    AppLogger.logComplete('ADMIN_ASSIGN_CLIENT_TO_TRAINER', { 
      clientId: dto.clientId, 
      trainerId: dto.trainerId 
    });
    return {
      success: true,
      data: {
        clientId: dto.clientId,
        trainerId: dto.trainerId,
        message: 'Client assigned to trainer successfully',
      },
    };
  }

  async getAllPlans() {
    const plans = await this.planModel
      .find()
      .populate('trainerId', 'userId businessName')
      .lean()
      .exec();

    const plansWithTrainerInfo = await Promise.all(
      plans.map(async (plan) => {
        const planObj = plan as any;
        let trainerName = 'Unknown Trainer';
        let trainerEmail = '';

        let trainerUserId: string | null = null;
        let trainerProfileId: string | null = null;
        
        if (planObj.trainerId) {
          // Get trainer profile ID (handle both populated and non-populated cases)
          trainerProfileId = (planObj.trainerId as any)?._id?.toString() || (planObj.trainerId as any)?.toString() || null;
          
          // Get trainer profile
          const trainerProfile = await this.trainerModel
            .findById(trainerProfileId)
            .populate('userId', 'firstName lastName email')
            .lean()
            .exec();

          if (trainerProfile) {
            // Try to get user info from populated userId
            if (trainerProfile.userId) {
              const trainerUser = trainerProfile.userId as any;
              trainerName = `${trainerUser.firstName} ${trainerUser.lastName}`.trim();
              trainerEmail = trainerUser.email || '';
              // Extract User ID (this is what frontend needs to match with User.id)
              trainerUserId = trainerUser._id?.toString() || null;
            } else {
              // Fallback: get user directly by userId
              const userId = (trainerProfile.userId as any)?._id || trainerProfile.userId;
              if (userId) {
                const trainerUser = await this.userModel.findById(userId).lean().exec();
                if (trainerUser) {
                  trainerName = `${trainerUser.firstName} ${trainerUser.lastName}`.trim();
                  trainerEmail = trainerUser.email || '';
                  trainerUserId = (trainerUser._id as any)?.toString() || null;
                }
              }
            }
          }
        }

        return {
          _id: planObj._id.toString(),
          name: planObj.name,
          description: planObj.description,
          difficulty: planObj.difficulty,
          trainerId: trainerUserId, // ✅ User ID (matches User.id in frontend)
          trainerProfileId: trainerProfileId, // ✅ TrainerProfile ID (for info)
          trainerName,
          trainerEmail,
          assignedClientCount: planObj.assignedClientIds?.length || 0,
          isTemplate: planObj.isTemplate,
          weeklyCost: planObj.weeklyCost || 0, // ✅ Weekly cost
          createdAt: planObj.createdAt,
          updatedAt: planObj.updatedAt,
        };
      }),
    );

    return {
      success: true,
      data: plansWithTrainerInfo,
    };
  }

  async getAllWorkouts() {
    const workouts = await this.workoutLogModel
      .find()
      .populate({
        path: 'clientId',
        populate: {
          path: 'userId',
          select: 'firstName lastName',
        },
      })
      .populate({
        path: 'trainerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName',
        },
      })
      .populate('weeklyPlanId', 'name')
      .sort({ workoutDate: -1 })
      .lean()
      .exec();

    const workoutsWithUserInfo = workouts.map((workout) => {
      const workoutObj = workout as any;
      let clientName = 'Unknown Client';
      let trainerName = 'Unknown Trainer';

      // Extract client name from populated clientId
      if (workoutObj.clientId && workoutObj.clientId.userId) {
        const clientUser = workoutObj.clientId.userId as any;
        clientName = `${clientUser.firstName || ''} ${clientUser.lastName || ''}`.trim();
        if (!clientName || clientName.length === 0) {
          clientName = 'Unknown Client';
        }
      }

      // Extract trainer name from populated trainerId
      if (workoutObj.trainerId && workoutObj.trainerId.userId) {
        const trainerUser = workoutObj.trainerId.userId as any;
        trainerName = `${trainerUser.firstName || ''} ${trainerUser.lastName || ''}`.trim();
        if (!trainerName || trainerName.length === 0) {
          trainerName = 'Unknown Trainer';
        }
      }

      return {
        _id: workoutObj._id.toString(),
        clientName,
        trainerName,
        workoutDate: workoutObj.workoutDate,
        isCompleted: workoutObj.isCompleted,
        isMissed: workoutObj.isMissed,
        planName: workoutObj.weeklyPlanId?.name || 'Unknown Plan',
        completedExercisesCount: workoutObj.completedExercises?.length || 0,
      };
    });

    // TransformInterceptor will wrap this in { success: true, data: workoutsWithUserInfo }
    return workoutsWithUserInfo;
  }

  async getWorkoutStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const workoutsToday = await this.workoutLogModel.countDocuments({
      workoutDate: { $gte: today, $lt: tomorrow },
      isCompleted: true,
    }).exec();

    const workoutsThisWeek = await this.workoutLogModel.countDocuments({
      workoutDate: { $gte: weekStart },
      isCompleted: true,
    }).exec();

    const totalWorkouts = await this.workoutLogModel.countDocuments({
      isCompleted: true,
    }).exec();

    const totalWorkoutLogs = await this.workoutLogModel.countDocuments().exec();
    const completionRate = totalWorkoutLogs > 0
      ? ((totalWorkouts / totalWorkoutLogs) * 100).toFixed(1)
      : '0.0';

    return {
      success: true,
      data: {
        workoutsToday,
        workoutsThisWeek,
        totalWorkouts,
        totalWorkoutLogs,
        completionRate: parseFloat(completionRate),
      },
    };
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.role !== undefined) updateData.role = dto.role;

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, { $set: updateData }, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found after update');
    }

    // If user is a trainer and subscriptionExpiresAt is provided, update TrainerProfile
    if (updatedUser.role === 'TRAINER' && dto.subscriptionExpiresAt) {
      AppLogger.logOperation('ADMIN_UPDATE_USER_TRAINER_SUB', {
        userId,
        subscriptionExpiresAt: dto.subscriptionExpiresAt,
      }, 'info');
      
      const trainerProfile = await this.trainerModel
        .findOne({ userId: new Types.ObjectId(userId) })
        .exec();

      if (trainerProfile) {
        trainerProfile.subscriptionExpiresAt = new Date(dto.subscriptionExpiresAt);
        // Also ensure status is ACTIVE if we are setting an expiry date
        trainerProfile.subscriptionStatus = SubscriptionStatus.ACTIVE;
        trainerProfile.isActive = true;
        await trainerProfile.save();
        
        AppLogger.logOperation('ADMIN_UPDATE_USER_TRAINER_SUB_SUCCESS', {
          userId,
          newExpiry: trainerProfile.subscriptionExpiresAt,
        }, 'info');
      } else {
        AppLogger.logOperation('ADMIN_UPDATE_USER_TRAINER_PROFILE_NOT_FOUND', { userId }, 'warn');
      }
    }

    return {
      success: true,
      data: {
        _id: updatedUser._id.toString(),
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
      },
    };
  }

  async deleteUser(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deleting admin users
    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot delete admin users');
    }

    // Delete associated profiles
    if (user.role === 'CLIENT') {
      await this.clientModel.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
    } else if (user.role === 'TRAINER') {
      await this.trainerModel.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
      // Also delete trainer's plans
      const trainerProfile = await this.trainerModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
      if (trainerProfile) {
        await this.planModel.deleteMany({ trainerId: trainerProfile._id }).exec();
      }
    }

    await this.userModel.findByIdAndDelete(userId).exec();

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For trainers, also update their profile status
    if (user.role === 'TRAINER') {
      const trainerProfile = await this.trainerModel
        .findOne({ userId: new Types.ObjectId(userId) })
        .exec();

      if (trainerProfile) {
        trainerProfile.isActive = dto.isActive;
        trainerProfile.subscriptionStatus = dto.isActive ? SubscriptionStatus.ACTIVE : SubscriptionStatus.SUSPENDED;
        
        if (dto.subscriptionExpiresAt) {
          trainerProfile.subscriptionExpiresAt = new Date(dto.subscriptionExpiresAt);
        }
        
        await trainerProfile.save();
      }
    }

    return {
      success: true,
      data: {
        userId,
        isActive: dto.isActive,
      },
    };
  }

  async updateWorkoutStatus(workoutId: string, body: { isCompleted?: boolean; isMissed?: boolean }) {
    AppLogger.logStart('ADMIN_UPDATE_WORKOUT_STATUS', { workoutId, body });
    const workout = await this.workoutLogModel.findById(workoutId).exec();
    if (!workout) {
      AppLogger.logWarning('ADMIN_UPDATE_WORKOUT_STATUS_NOT_FOUND', { workoutId });
      throw new NotFoundException('Workout not found');
    }

    const wasMissed = workout.isMissed;
    AppLogger.logOperation('ADMIN_UPDATE_WORKOUT_STATUS_CURRENT_STATE', { 
      workoutId, 
      isCompleted: workout.isCompleted, 
      isMissed: wasMissed 
    }, 'debug');

    if (body.isCompleted !== undefined) {
      workout.isCompleted = body.isCompleted;
      if (body.isCompleted) {
        workout.isMissed = false;
      }
    }

    if (body.isMissed !== undefined) {
      workout.isMissed = body.isMissed;
      if (body.isMissed) {
        workout.isCompleted = false;
        
        // If marking as missed and it wasn't already missed, add penalty
        if (body.isMissed === true && wasMissed === false) {
          AppLogger.logOperation('ADMIN_UPDATE_WORKOUT_STATUS_ADDING_PENALTY', { 
            workoutId, 
            clientId: workout.clientId.toString() 
          }, 'info');
          try {
            await this.gamificationService.addPenaltyToBalance(
              workout.clientId.toString(),
              1, // 1€ per missed workout
              'Missed workout penalty',
              workout.weeklyPlanId,
            );
            AppLogger.logOperation('ADMIN_UPDATE_WORKOUT_STATUS_PENALTY_ADDED', { 
              workoutId, 
              clientId: workout.clientId.toString(),
              amount: 1 
            }, 'info');
          } catch (error) {
            AppLogger.logError('ADMIN_UPDATE_WORKOUT_STATUS_PENALTY_ERROR', { 
              workoutId, 
              clientId: workout.clientId.toString() 
            }, error as Error);
            // Don't throw - workout update should succeed even if penalty fails
          }
        }
      }
    }

    await workout.save();

    AppLogger.logComplete('ADMIN_UPDATE_WORKOUT_STATUS', { 
      workoutId, 
      isCompleted: workout.isCompleted, 
      isMissed: workout.isMissed 
    });

    return {
      success: true,
      data: {
        _id: workout._id.toString(),
        isCompleted: workout.isCompleted,
        isMissed: workout.isMissed,
      },
    };
  }

  async deleteWorkout(workoutId: string) {
    const workout = await this.workoutLogModel.findById(workoutId).exec();
    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    await this.workoutLogModel.findByIdAndDelete(workoutId).exec();

    return {
      success: true,
      message: 'Workout deleted successfully',
    };
  }
}
