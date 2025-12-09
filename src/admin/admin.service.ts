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
    console.log('[AdminService] getAllUsers called');
    const users = await this.userModel.find().exec();
    console.log(`[AdminService] Found ${users.length} users in database`);

    const usersWithTrainerInfo = await Promise.all(
      users.map(async (user) => {
        const userObj = user.toObject();
        let trainerId: string | null = null;
        let trainerName: string | null = null;

        // If user is a CLIENT, find their trainer and get clientProfileId
        let clientProfileId: string | null = null;
        if (user.role === 'CLIENT') {
          const clientProfile = await this.clientModel
            .findOne({ userId: user._id })
            .exec();

          // Store clientProfileId if profile exists
          if (clientProfile) {
            clientProfileId = clientProfile._id.toString();
          }

          if (clientProfile && clientProfile.trainerId) {
            // Get trainer profile ID (could be ObjectId or string)
            let trainerProfileId = (clientProfile.trainerId as any)?._id 
              ? (clientProfile.trainerId as any)._id 
              : clientProfile.trainerId;
            
            let trainerProfileFound = false;
            
            // Try to find trainer profile by ID first
            try {
              let trainerProfileIdObj: Types.ObjectId;
              if (trainerProfileId instanceof Types.ObjectId) {
                trainerProfileIdObj = trainerProfileId;
              } else if (typeof trainerProfileId === 'string') {
                trainerProfileIdObj = new Types.ObjectId(trainerProfileId);
              } else {
                trainerProfileIdObj = trainerProfileId;
              }
              
              const trainerProfile = await this.trainerModel
                .findById(trainerProfileIdObj)
                .populate('userId', 'firstName lastName')
                .exec();

              if (trainerProfile && trainerProfile.userId) {
                const trainerUser = trainerProfile.userId as any;
                trainerName = `${trainerUser.firstName} ${trainerUser.lastName}`.trim();
                trainerId = trainerUser._id.toString(); // Use User ID, not TrainerProfile ID
                trainerProfileFound = true;
              }
            } catch (e) {
              // If lookup by TrainerProfile ID fails, try by User ID
              // (in case trainerId was incorrectly stored as User ID)
            }
            
            // Fallback: if trainerProfile not found by ID, try to find by userId
            // (in case trainerId was incorrectly stored as User ID)
            if (!trainerProfileFound) {
              try {
                const trainerUser = await this.userModel.findById(trainerProfileId).exec();
                if (trainerUser && trainerUser.role === 'TRAINER') {
                  trainerName = `${trainerUser.firstName} ${trainerUser.lastName}`.trim();
                  trainerId = trainerUser._id.toString(); // Use User ID
                }
              } catch (e) {
                // If all lookups fail, trainerName remains null
              }
            }
          }
        }

        // Get isActive status - for trainers, check trainer profile
        let isActive = true; // Default to active
        if (user.role === 'TRAINER') {
          const trainerProfile = await this.trainerModel
            .findOne({ userId: user._id })
            .exec();
          if (trainerProfile) {
            isActive = trainerProfile.isActive ?? true;
          }
        }

        return {
          _id: userObj._id.toString(),
          email: userObj.email,
          firstName: userObj.firstName,
          lastName: userObj.lastName,
          role: userObj.role,
          trainerId: trainerId,
          trainerName: trainerName,
          clientProfileId: clientProfileId, // Add clientProfileId for CLIENT users
          isActive: isActive,
        };
      }),
    );

    console.log(`[AdminService] Returning ${usersWithTrainerInfo.length} users with trainer info`);
    return {
      success: true,
      data: usersWithTrainerInfo,
    };
  }

  async getStats() {
    console.log('[AdminService] getStats called');
    const totalUsers = await this.userModel.countDocuments().exec();
    const totalTrainers = await this.userModel.countDocuments({ role: 'TRAINER' }).exec();
    const totalClients = await this.userModel.countDocuments({ role: 'CLIENT' }).exec();
    console.log(`[AdminService] Stats - Users: ${totalUsers}, Trainers: ${totalTrainers}, Clients: ${totalClients}`);

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

    console.log(`[AdminService] Today's check-ins: ${todayCheckIns}`);
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
    console.log(`[AdminService] assignClientToTrainer called - clientId: ${dto.clientId}, trainerId: ${dto.trainerId || 'null (unassign)'}`);
    
    // Verify client user exists and is a CLIENT
    const clientUser = await this.userModel.findById(dto.clientId).exec();
    if (!clientUser) {
      console.log(`[AdminService] Client user not found: ${dto.clientId}`);
      throw new NotFoundException('Client user not found');
    }
    if (clientUser.role !== 'CLIENT') {
      console.log(`[AdminService] User is not a CLIENT: ${clientUser.role}`);
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
          console.log(`[AdminService] Removed client ${clientProfile._id} from old trainer's clientIds`);
        }
        
        // Remove trainerId from client profile
        clientProfile.trainerId = null as any;
        await clientProfile.save();
        console.log(`[AdminService] Unassigned client ${dto.clientId} from trainer`);
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
      console.log(`[AdminService] Trainer user not found: ${dto.trainerId}`);
      throw new NotFoundException('Trainer user not found');
    }
    if (trainerUser.role !== 'TRAINER') {
      console.log(`[AdminService] User is not a TRAINER: ${trainerUser.role}`);
      throw new BadRequestException('User is not a TRAINER');
    }

    // Get trainer profile
    const trainerProfile = await this.trainerModel
      .findOne({ userId: new Types.ObjectId(dto.trainerId) })
      .exec();

    if (!trainerProfile) {
      console.log(`[AdminService] Trainer profile not found for userId: ${dto.trainerId}`);
      throw new NotFoundException('Trainer profile not found');
    }

    console.log(`[AdminService] Found trainer profile: ${trainerProfile._id}`);

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
        console.log(`[AdminService] Removed client from old trainer's clientIds`);
      }
    }

    if (clientProfile) {
      // Update existing client profile
      console.log(`[AdminService] Updating existing client profile: ${clientProfile._id}`);
      clientProfile.trainerId = trainerProfile._id; // Use trainer profile ID, not user ID
      await clientProfile.save();
      console.log(`[AdminService] Client profile updated with trainerId: ${trainerProfile._id}`);
    } else {
      // Create new client profile
      console.log(`[AdminService] Creating new client profile for userId: ${dto.clientId}`);
      clientProfile = new this.clientModel({
        userId: new Types.ObjectId(dto.clientId),
        trainerId: trainerProfile._id, // Use trainer profile ID, not user ID
      });
      await clientProfile.save();
      console.log(`[AdminService] Client profile created: ${clientProfile._id}`);
    }

    // Update trainer's clientIds array
    if (!trainerProfile.clientIds.includes(clientProfile._id)) {
      trainerProfile.clientIds.push(clientProfile._id);
      await trainerProfile.save();
      console.log(`[AdminService] Added client ${clientProfile._id} to trainer's clientIds`);
    } else {
      console.log(`[AdminService] Client ${clientProfile._id} already in trainer's clientIds`);
    }

    console.log(`[AdminService] Successfully assigned client ${dto.clientId} to trainer ${dto.trainerId}`);
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

        if (planObj.trainerId) {
          // Get trainer profile ID (handle both populated and non-populated cases)
          const trainerProfileId = (planObj.trainerId as any)?._id || planObj.trainerId;
          
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
            } else {
              // Fallback: get user directly by userId
              const userId = (trainerProfile.userId as any)?._id || trainerProfile.userId;
              if (userId) {
                const trainerUser = await this.userModel.findById(userId).lean().exec();
                if (trainerUser) {
                  trainerName = `${trainerUser.firstName} ${trainerUser.lastName}`.trim();
                  trainerEmail = trainerUser.email || '';
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
          trainerName,
          trainerEmail,
          assignedClientCount: planObj.assignedClientIds?.length || 0,
          isTemplate: planObj.isTemplate,
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
    console.log(`[AdminService] updateWorkoutStatus START - workoutId: ${workoutId}, body:`, body);
    const workout = await this.workoutLogModel.findById(workoutId).exec();
    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    const wasMissed = workout.isMissed;
    console.log(`[AdminService] updateWorkoutStatus - Current state: isCompleted=${workout.isCompleted}, isMissed=${wasMissed}`);

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
          console.log(`[AdminService] updateWorkoutStatus - Workout ${workoutId} is being marked as missed, adding penalty`);
          try {
            await this.gamificationService.addPenaltyToBalance(
              workout.clientId.toString(),
              1, // 1€ per missed workout
              'Missed workout penalty',
              workout.weeklyPlanId,
            );
            console.log(`[AdminService] updateWorkoutStatus - Successfully added 1€ penalty for missed workout ${workoutId}`);
          } catch (error) {
            console.error(`[AdminService] updateWorkoutStatus - Error adding penalty for missed workout ${workoutId}:`, error);
            // Don't throw - workout update should succeed even if penalty fails
          }
        }
      }
    }

    await workout.save();

    console.log(`[AdminService] updateWorkoutStatus SUCCESS - workoutId: ${workoutId}, isCompleted: ${workout.isCompleted}, isMissed: ${workout.isMissed}`);

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
