import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TrainersService } from './trainers.service';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { SubscriptionUpdateDto } from './dto/subscription-update.dto';
import { AssignClientDto } from './dto/assign-client.dto';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('trainers')
@ApiBearerAuth('JWT-auth')
@Controller('trainers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrainersController {
  constructor(private trainersService: TrainersService) {}

  @Get('profile')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Get trainer profile' })
  @ApiResponse({ status: 200, description: 'Trainer profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Trainer role required' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.trainersService.getProfile(user.sub);
  }

  @Patch('profile')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Update trainer profile' })
  @ApiResponse({ status: 200, description: 'Trainer profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Trainer role required' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTrainerDto,
  ) {
    return this.trainersService.updateProfile(user.sub, dto);
  }

  @Get('clients')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Get trainer clients list' })
  @ApiResponse({ status: 200, description: 'Clients list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Trainer role required' })
  async getClients(@CurrentUser() user: JwtPayload) {
    return this.trainersService.getClients(user.sub);
  }

  @Get('subscription')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Get trainer subscription details' })
  @ApiResponse({ status: 200, description: 'Subscription details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Trainer role required' })
  async getSubscription(@CurrentUser() user: JwtPayload) {
    const profile = await this.trainersService.getProfile(user.sub);
    return {
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionTier: profile.subscriptionTier,
      subscriptionExpiresAt: profile.subscriptionExpiresAt,
      lastPaymentDate: profile.lastPaymentDate,
      isActive: profile.isActive,
    };
  }

  @Patch('subscription')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Update trainer subscription' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Trainer role required' })
  async updateSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubscriptionUpdateDto,
  ) {
    return this.trainersService.updateSubscription(user.sub, dto);
  }

  @Post('clients/:id/assign')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Assign client to trainer' })
  @ApiParam({ name: 'id', description: 'Client profile ID' })
  @ApiResponse({ status: 201, description: 'Client assigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Client already assigned or max clients reached' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Trainer role required' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async assignClient(
    @CurrentUser() user: JwtPayload,
    @Param('id') clientProfileId: string,
  ) {
    return this.trainersService.assignClientToTrainer(user.sub, clientProfileId);
  }

  @Delete('clients/:id')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Remove client from trainer' })
  @ApiParam({ name: 'id', description: 'Client profile ID' })
  @ApiResponse({ status: 200, description: 'Client removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client does not belong to trainer' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async removeClient(
    @CurrentUser() user: JwtPayload,
    @Param('id') clientProfileId: string,
  ) {
    return this.trainersService.removeClientFromTrainer(user.sub, clientProfileId);
  }

  @Post('subscription/upgrade')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Upgrade subscription tier' })
  @ApiResponse({ status: 200, description: 'Subscription upgraded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid tier upgrade' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Trainer role required' })
  async upgradeSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpgradeSubscriptionDto,
  ) {
    return this.trainersService.upgradeSubscription(user.sub, dto);
  }

  @Get('pending-week-requests')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Get clients who requested next week' })
  @ApiResponse({ status: 200, description: 'Pending requests retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Trainer role required' })
  async getPendingWeekRequests(@CurrentUser() user: JwtPayload) {
    return this.trainersService.getPendingWeekRequests(user.sub);
  }

}

