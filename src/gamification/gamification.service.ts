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
    @Inject(forwardRef(() => ClientsService))
    private clientsService: ClientsService,
    @Inject(forwardRef(() => TrainersService))
    private trainersService: TrainersService,
  ) {}

  async getPenaltyStatus(clientId: string): Promise<PenaltyStatusDto> {
    console.log(`[GamificationService] getPenaltyStatus START - clientId: ${clientId}`);
    
    const clientProfile = await this.clientsService.getProfile(clientId);
    if (!clientProfile) {
      console.error(`[GamificationService] Client profile not found: ${clientId}`);
      throw new NotFoundException('Client profile not found.');
    }

    const recentPenalties = await this.penaltyRecordModel
      .find({ clientId: (clientProfile as any)._id || clientProfile.userId })
      .sort({ weekStartDate: -1 })
      .limit(4)
      .exec();

    const balance = clientProfile.balance || 0;
    const monthlyBalance = clientProfile.monthlyBalance || 0;

    console.log(`[GamificationService] getPenaltyStatus - balance: ${balance}€, monthlyBalance: ${monthlyBalance}€, penaltyHistory entries: ${clientProfile.penaltyHistory?.length || 0}`);

    return {
      isPenaltyMode: clientProfile.isPenaltyMode,
      consecutiveMissedWorkouts: clientProfile.consecutiveMissedWorkouts,
      currentStreak: clientProfile.currentStreak,
      totalWorkoutsCompleted: clientProfile.totalWorkoutsCompleted,
      balance,
      monthlyBalance,
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
    if (!clientProfile.trainerId || clientProfile.trainerId.toString() !== trainerProfileId) {
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

  /**
   * Add penalty to client's running tab balance
   * Called when a workout is missed (+1€ per missed workout)
   */
  async addPenaltyToBalance(
    clientProfileId: string | Types.ObjectId,
    amount: number,
    reason: string,
    planId?: Types.ObjectId,
  ): Promise<void> {
    console.log(`[GamificationService] addPenaltyToBalance START - clientId: ${clientProfileId}, amount: ${amount}, reason: ${reason}`);
    
    const client = await this.clientProfileModel.findById(clientProfileId).exec();
    if (!client) {
      console.error(`[GamificationService] Client profile not found: ${clientProfileId}`);
      throw new NotFoundException('Client profile not found');
    }

    const oldBalance = client.balance || 0;
    const oldMonthlyBalance = client.monthlyBalance || 0;

    const penaltyEntry = {
      date: new Date(),
      amount,
      reason,
      planId: planId || undefined,
    };

    // Update balance and monthly balance
    const updatedBalance = oldBalance + amount;
    const updatedMonthlyBalance = oldMonthlyBalance + amount;

    console.log(`[GamificationService] Balance update: ${oldBalance}€ -> ${updatedBalance}€ (monthly: ${oldMonthlyBalance}€ -> ${updatedMonthlyBalance}€)`);

    await this.clientProfileModel.findByIdAndUpdate(
      clientProfileId,
      {
        $set: {
          balance: updatedBalance,
          monthlyBalance: updatedMonthlyBalance,
        },
        $push: {
          penaltyHistory: penaltyEntry,
        },
      },
    ).exec();

    console.log(`[GamificationService] addPenaltyToBalance SUCCESS - New balance: ${updatedBalance}€`);
  }

  /**
   * Remove penalties for a specific plan from client's penaltyHistory
   * Used when unassigning a plan from a client
   */
  async removePenaltiesForPlan(
    clientProfileId: string | Types.ObjectId,
    planId: string | Types.ObjectId,
  ): Promise<number> {
    console.log(`[GamificationService] removePenaltiesForPlan START - clientId: ${clientProfileId}, planId: ${planId}`);
    
    const client = await this.clientProfileModel.findById(clientProfileId).exec();
    if (!client) {
      console.error(`[GamificationService] Client profile not found: ${clientProfileId}`);
      throw new NotFoundException('Client profile not found');
    }

    const planIdObj = typeof planId === 'string' ? new Types.ObjectId(planId) : planId;
    const penaltyHistory = (client as any).penaltyHistory || [];
    
    // Find penalties for this plan
    const penaltiesToRemove = penaltyHistory.filter((penalty: any) => {
      if (!penalty.planId) return false;
      const penaltyPlanId = penalty.planId.toString();
      const targetPlanId = planIdObj.toString();
      return penaltyPlanId === targetPlanId;
    });

    if (penaltiesToRemove.length === 0) {
      console.log(`[GamificationService] removePenaltiesForPlan - No penalties found for plan ${planId}`);
      return 0;
    }

    // Calculate total amount to subtract
    const totalAmount = penaltiesToRemove.reduce((sum: number, penalty: any) => {
      return sum + (penalty.amount || 0);
    }, 0);

    console.log(`[GamificationService] removePenaltiesForPlan - Found ${penaltiesToRemove.length} penalties, total amount: ${totalAmount}€`);

    const oldBalance = client.balance || 0;
    const oldMonthlyBalance = client.monthlyBalance || 0;
    
    // Calculate new balances
    const updatedBalance = Math.max(0, oldBalance - totalAmount);
    const updatedMonthlyBalance = Math.max(0, oldMonthlyBalance - totalAmount);

    console.log(`[GamificationService] removePenaltiesForPlan - Balance update: ${oldBalance}€ -> ${updatedBalance}€ (monthly: ${oldMonthlyBalance}€ -> ${updatedMonthlyBalance}€)`);

    // Remove penalties from penaltyHistory and update balances
    const updatedPenaltyHistory = penaltyHistory.filter((penalty: any) => {
      if (!penalty.planId) return true;
      const penaltyPlanId = penalty.planId.toString();
      const targetPlanId = planIdObj.toString();
      return penaltyPlanId !== targetPlanId;
    });

    await this.clientProfileModel.findByIdAndUpdate(
      clientProfileId,
      {
        $set: {
          balance: updatedBalance,
          monthlyBalance: updatedMonthlyBalance,
          penaltyHistory: updatedPenaltyHistory,
        },
      },
    ).exec();

    console.log(`[GamificationService] removePenaltiesForPlan SUCCESS - Removed ${penaltiesToRemove.length} penalties, new balance: ${updatedBalance}€`);
    
    return penaltiesToRemove.length;
  }

  /**
   * Clear client's balance (after payment)
   */
  async clearBalance(clientProfileId: string | Types.ObjectId): Promise<void> {
    await this.clientProfileModel.findByIdAndUpdate(
      clientProfileId,
      {
        $set: {
          balance: 0,
          monthlyBalance: 0,
          lastBalanceReset: new Date(),
        },
      },
    ).exec();
  }

  /**
   * Check if client can access app (monthly paywall)
   * Returns false if new month and balance > 0
   */
  async checkMonthlyPaywall(clientProfileId: string | Types.ObjectId): Promise<boolean> {
    const client = await this.clientProfileModel.findById(clientProfileId).exec();
    if (!client) {
      return false;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // If no last reset, allow access (first time)
    if (!client.lastBalanceReset) {
      return true;
    }

    const lastReset = new Date(client.lastBalanceReset);
    const lastResetMonth = lastReset.getMonth();
    const lastResetYear = lastReset.getFullYear();

    // If new month/year and balance > 0, block access
    if (
      (currentMonth !== lastResetMonth || currentYear !== lastResetYear) &&
      (client.balance || 0) > 0
    ) {
      return false;
    }

    return true;
  }
}

