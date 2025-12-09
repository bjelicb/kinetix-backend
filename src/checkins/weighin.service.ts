import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WeighIn, WeighInDocument } from './schemas/weighin.schema';
import { ClientsService } from '../clients/clients.service';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';

@Injectable()
export class WeighInService {
  constructor(
    @InjectModel(WeighIn.name) private weighInModel: Model<WeighInDocument>,
    private clientsService: ClientsService,
  ) {}

  /**
   * Check if date is a Monday
   */
  private isMonday(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 1; // Monday is 1
  }

  /**
   * Get the Monday of the week for a given date
   */
  private getMondayOfWeek(date: Date): Date {
    const monday = new Date(date);
    const dayOfWeek = monday.getDay();
    const diff = monday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * Get client's current active plan
   */
  private getActivePlan(clientProfile: ClientProfileDocument): { planId: Types.ObjectId; planStartDate: Date } | null {
    // Check planHistory first (new way)
    if (clientProfile.planHistory && clientProfile.planHistory.length > 0) {
      // Get the most recent plan entry
      const latestEntry = clientProfile.planHistory[clientProfile.planHistory.length - 1];
      const now = new Date();
      
      // Check if plan is still active (within date range)
      if (latestEntry.planStartDate <= now && latestEntry.planEndDate >= now) {
        return {
          planId: latestEntry.planId as Types.ObjectId,
          planStartDate: latestEntry.planStartDate,
        };
      }
    }
    
    // Fallback to currentPlanId (backward compatibility)
    if (clientProfile.currentPlanId && clientProfile.planStartDate) {
      return {
        planId: clientProfile.currentPlanId as Types.ObjectId,
        planStartDate: clientProfile.planStartDate,
      };
    }
    
    return null;
  }

  /**
   * Calculate weight change percentage
   */
  private calculateWeightChange(currentWeight: number, previousWeight: number): number {
    if (previousWeight === 0) return 0;
    return ((currentWeight - previousWeight) / previousWeight) * 100;
  }

  /**
   * Create a weigh-in record
   * Can be recorded on any day, but Monday is recommended (plan start day)
   * Links weigh-in to active plan if available
   */
  async createWeighIn(clientId: string, weight: number, date?: Date, photoUrl?: string, notes?: string, planId?: string): Promise<WeighIn> {
    const client = await this.clientsService.getProfile(clientId);
    const clientProfile = client as ClientProfileDocument;
    const clientProfileId = (clientProfile as any)._id;

    const weighInDate = date ? new Date(date) : new Date();
    weighInDate.setHours(0, 0, 0, 0);

    // Check if weigh-in already exists for this date
    const existing = await this.weighInModel.findOne({
      clientId: clientProfileId,
      date: weighInDate,
    }).exec();

    if (existing) {
      throw new BadRequestException('Weigh-in already recorded for this date.');
    }

    // Get active plan and link weigh-in to it
    let linkedPlanId: Types.ObjectId | undefined;
    let linkedPlanStartDate: Date | undefined;
    const isMonday = this.isMonday(weighInDate);
    
    // Try to get plan from parameter first, then from client's active plan
    if (planId) {
      linkedPlanId = new Types.ObjectId(planId);
      // Get plan start date from client's plan history
      const activePlan = this.getActivePlan(clientProfile);
      if (activePlan && activePlan.planId.toString() === planId) {
        linkedPlanStartDate = activePlan.planStartDate;
      }
    } else {
      const activePlan = this.getActivePlan(clientProfile);
      if (activePlan) {
        linkedPlanId = activePlan.planId;
        linkedPlanStartDate = activePlan.planStartDate;
      }
    }

    // If we have a plan start date, check if weigh-in date matches the Monday of that plan week
    let isMandatory = false;
    if (linkedPlanStartDate) {
      const planWeekMonday = this.getMondayOfWeek(linkedPlanStartDate);
      const weighInMonday = this.getMondayOfWeek(weighInDate);
      // Mark as mandatory if it's on the Monday of the plan week
      isMandatory = isMonday && planWeekMonday.getTime() === weighInMonday.getTime();
    } else {
      // If no plan, mark as mandatory only if it's Monday
      isMandatory = isMonday;
    }

    // Get last weigh-in to check for spikes (not just last week, but last recorded)
    const lastWeighIn = await this.weighInModel.findOne({
      clientId: clientProfileId,
    }).sort({ date: -1 }).exec();

    let isWeightSpike = false;
    let aiFlagged = false;
    let aiMessage: string | undefined;

    // Check for weight spike (>5% increase)
    if (lastWeighIn) {
      const weightChange = this.calculateWeightChange(weight, lastWeighIn.weight);
      
      if (weightChange > 5) {
        isWeightSpike = true;
        aiFlagged = true;
        aiMessage = `Your weight increased by ${weightChange.toFixed(1)}% since your last weigh-in. Please provide an explanation for this significant change.`;
      } else if (weightChange < -5) {
        // Significant weight loss (might be concerning)
        aiFlagged = true;
        aiMessage = `Your weight decreased by ${Math.abs(weightChange).toFixed(1)}% since your last weigh-in. If this was intentional, great job! If not, please let your trainer know.`;
      }
    }

    const weighIn = new this.weighInModel({
      clientId: clientProfileId,
      planId: linkedPlanId,
      planStartDate: linkedPlanStartDate,
      weight,
      date: weighInDate,
      photoUrl,
      notes,
      isMandatory,
      isWeightSpike,
      aiFlagged,
      aiMessage,
    });

    return weighIn.save();
  }

  /**
   * Get weigh-in history for a client
   */
  async getWeighInHistory(clientId: string): Promise<WeighIn[]> {
    const client = await this.clientsService.getProfile(clientId);
    const clientProfileId = (client as any)._id;

    return this.weighInModel
      .find({ clientId: clientProfileId })
      .sort({ date: -1 })
      .exec();
  }

  /**
   * Get latest weigh-in for a client
   */
  async getLatestWeighIn(clientId: string): Promise<WeighIn | null> {
    const client = await this.clientsService.getProfile(clientId);
    const clientProfileId = (client as any)._id;

    return this.weighInModel
      .findOne({ clientId: clientProfileId })
      .sort({ date: -1 })
      .exec();
  }
}

