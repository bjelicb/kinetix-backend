import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrainerProfile, TrainerProfileDocument } from '../schemas/trainer-profile.schema';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

@Injectable()
export class SubscriptionChecker {
  constructor(
    @InjectModel(TrainerProfile.name)
    private trainerModel: Model<TrainerProfileDocument>,
  ) {}

  @Cron('0 1 * * *') // Every day at 1:00 AM
  async checkAndSuspendExpiredSubscriptions() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await this.trainerModel.updateMany(
        {
          subscriptionExpiresAt: { $lt: today },
          isActive: true,
        },
        {
          $set: {
            isActive: false,
            subscriptionStatus: SubscriptionStatus.SUSPENDED,
          },
        },
      ).exec();

      console.log(`[SubscriptionChecker] Suspended ${result.modifiedCount} expired subscriptions`);
    } catch (error) {
      console.error('[SubscriptionChecker] Error checking subscriptions:', error);
    }
  }
}

