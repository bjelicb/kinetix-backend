import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { TrainersService } from '../../trainers/trainers.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

@Injectable()
export class SaasKillswitchGuard implements CanActivate {
  constructor(
    private clientsService: ClientsService,
    private trainersService: TrainersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Rule 1: Only check for CLIENT requests
    if (!user || user.role !== 'CLIENT') {
      return true; // Trainers/Admins bypass
    }

    console.log(`[SaasKillswitchGuard] Checking subscription for client: ${user.sub} (role: ${user.role})`);

    try {
      // Rule 2: Get client's trainer
      const client = await this.clientsService.getProfile(user.sub);
      if (!client) {
        throw new UnauthorizedException('Client profile not found');
      }

      // Get trainer profile by trainerId (which is TrainerProfile._id)
      // Handle both ObjectId and string formats
      let trainerId: string;
      if (client.trainerId && typeof client.trainerId === 'object' && (client.trainerId as any)._id) {
        // If it's an ObjectId object, extract the _id
        trainerId = (client.trainerId as any)._id.toString();
      } else if (client.trainerId && typeof client.trainerId === 'object') {
        // If it's an ObjectId, convert directly
        trainerId = (client.trainerId as any).toString();
      } else {
        // If it's already a string
        trainerId = String(client.trainerId);
      }
      const trainer = await this.trainersService.getProfileById(trainerId);
      if (!trainer) {
        throw new UnauthorizedException('Trainer profile not found');
      }

      // 🔍 DEBUG: Log trainer subscription data
      console.log(`[SaasKillswitchGuard] 🔍 TRAINER DEBUG DATA:`);
      console.log(`  - Trainer ID: ${trainerId}`);
      console.log(`  - isActive: ${trainer.isActive}`);
      console.log(`  - subscriptionStatus: ${trainer.subscriptionStatus}`);
      console.log(`  - subscriptionExpiresAt: ${trainer.subscriptionExpiresAt}`);
      console.log(`  - Current Date: ${new Date().toISOString()}`);
      console.log(`  - Is Expired: ${trainer.subscriptionExpiresAt < new Date()}`);

      // Rule 3: CRITICAL CHECK - Trainer subscription status
      if (!trainer.isActive || trainer.subscriptionStatus !== SubscriptionStatus.ACTIVE) {
        console.log(`[SaasKillswitchGuard] 🔴 FAILED Rule 3: isActive=${trainer.isActive}, subscriptionStatus=${trainer.subscriptionStatus}`);
        throw new ForbiddenException({
          message: "Access denied. Your trainer's subscription is inactive.",
          code: 'TRAINER_INACTIVE', // Explicit code for client detection
        });
      }

      // Rule 4: Check subscription expiration
      if (trainer.subscriptionExpiresAt < new Date()) {
        console.log(`[SaasKillswitchGuard] 🔴 FAILED Rule 4: subscriptionExpiresAt (${trainer.subscriptionExpiresAt}) < now, AUTO-SUSPENDING!`);
        // Auto-suspend using service methods
        await this.trainersService.updateSubscription(
          (trainer.userId as any).toString(),
          {
            subscriptionStatus: SubscriptionStatus.SUSPENDED,
          },
        );
        await this.trainersService.updateProfile((trainer.userId as any).toString(), {
          isActive: false,
        } as any);

        throw new ForbiddenException({
          message: 'Access denied. Subscription has expired.',
          code: 'TRAINER_INACTIVE',
        });
      }

      return true;
    } catch (error) {
      // Re-throw ForbiddenException and UnauthorizedException
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      // Convert NotFoundException to UnauthorizedException (profile not found = unauthorized)
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Trainer or client profile not found');
      }
      // For other errors, log and deny access
      console.error('[SaasKillswitchGuard] Error:', error);
      throw new UnauthorizedException('Unable to verify subscription status');
    }
  }
}

