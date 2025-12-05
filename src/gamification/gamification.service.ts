import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PenaltyRecord, PenaltyRecordDocument } from './schemas/penalty-record.schema';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { PenaltyStatusDto } from './dto/penalty-status.dto';

@Injectable()
export class GamificationService {
  constructor(
    @InjectModel(PenaltyRecord.name) private penaltyRecordModel: Model<PenaltyRecordDocument>,
    @InjectModel(ClientProfile.name) private clientProfileModel: Model<ClientProfileDocument>,
    private clientsService: ClientsService,
    @Inject(forwardRef(() => TrainersService))
    private trainersService: TrainersService,
  ) {}

  async getPenaltyStatus(clientId: string): Promise<PenaltyStatusDto> {
    const clientProfile = await this.clientsService.getProfile(clientId);
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found.');
    }

    const recentPenalties = await this.penaltyRecordModel
      .find({ clientId: (clientProfile as any)._id || clientProfile.userId })
      .sort({ weekStartDate: -1 })
      .limit(4)
      .exec();

    return {
      isPenaltyMode: clientProfile.isPenaltyMode,
      consecutiveMissedWorkouts: clientProfile.consecutiveMissedWorkouts,
      currentStreak: clientProfile.currentStreak,
      totalWorkoutsCompleted: clientProfile.totalWorkoutsCompleted,
      recentPenalties: recentPenalties.map((p) => ({
        weekStartDate: p.weekStartDate,
        weekEndDate: p.weekEndDate,
        totalMissedWorkouts: p.totalMissedWorkouts,
        penaltyType: p.penaltyType,
      })),
    };
  }

  async getPenaltyHistory(clientId: string): Promise<PenaltyRecord[]> {
    const clientProfile = await this.clientsService.getProfile(clientId);
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found.');
    }

    return this.penaltyRecordModel
      .find({ clientId: (clientProfile as any)._id || clientProfile.userId })
      .sort({ weekStartDate: -1 })
      .exec();
  }

  async resetPenalty(clientId: string, trainerUserId: string): Promise<void> {
    // clientId is profileId from URL, need to get client profile
    const clientProfile = await this.clientProfileModel.findById(clientId).exec();
    if (!clientProfile) {
      throw new NotFoundException('Client profile not found.');
    }

    // Get trainer profile to get profileId
    const trainerProfile = await this.trainersService.getProfile(trainerUserId);
    const trainerProfileId = (trainerProfile as any)._id.toString();

    // Verify trainer owns this client
    if (clientProfile.trainerId.toString() !== trainerProfileId) {
      throw new NotFoundException('Client not found or not authorized.');
    }

    (clientProfile as any).isPenaltyMode = false;
    (clientProfile as any).consecutiveMissedWorkouts = 0;
    await (clientProfile as ClientProfileDocument).save();
  }

  async getLeaderboard(trainerUserId: string): Promise<any[]> {
    // Get trainer profile to get profileId
    const trainerProfile = await this.trainersService.getProfile(trainerUserId);
    const trainerProfileId = (trainerProfile as any)._id;

    // Get all clients for this trainer
    const clients = await this.clientProfileModel
      .find({ trainerId: trainerProfileId })
      .exec();

    // Calculate rankings based on completion rate and streak
    const rankings = clients.map((client) => ({
      clientId: client._id,
      totalWorkoutsCompleted: client.totalWorkoutsCompleted,
      currentStreak: client.currentStreak,
      isPenaltyMode: client.isPenaltyMode,
      consecutiveMissedWorkouts: client.consecutiveMissedWorkouts,
    }));

    // Sort by streak (descending), then by total workouts (descending)
    rankings.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) {
        return b.currentStreak - a.currentStreak;
      }
      return b.totalWorkoutsCompleted - a.totalWorkoutsCompleted;
    });

    return rankings;
  }
}

