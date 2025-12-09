import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientsService } from '../../clients/clients.service';
import { GamificationService } from '../../gamification/gamification.service';

@Injectable()
export class MonthlyPaywallGuard implements CanActivate {
  constructor(
    private clientsService: ClientsService,
    private gamificationService: GamificationService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Only apply to CLIENT role
    if (!user || user.role !== 'CLIENT') {
      return true;
    }

    // Get client profile
    try {
      const client = await this.clientsService.getProfile(user.sub);
      const clientProfileId = (client as any)._id;

      // Check monthly paywall
      const canAccess = await this.gamificationService.checkMonthlyPaywall(clientProfileId);

      if (!canAccess) {
        // Check if route is payment-related (allow access to payment page)
        const route = request.route?.path || request.url;
        const isPaymentRoute = route.includes('/payment') || route.includes('/balance');

        if (!isPaymentRoute) {
          throw new ForbiddenException(
            'Your monthly balance must be cleared before accessing the app. Please make a payment to continue.',
          );
        }
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // If error checking paywall, allow access (fail gracefully)
      return true;
    }
  }
}

