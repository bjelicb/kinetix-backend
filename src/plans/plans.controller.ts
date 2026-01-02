import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AppLogger } from '../common/utils/logger.utils';

@ApiTags('plans')
@ApiBearerAuth('JWT-auth')
@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Post()
  @Roles('TRAINER', 'ADMIN')
  async createPlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePlanDto,
  ) {
    // If user is ADMIN, trainerId must be provided
    if (user.role === 'ADMIN' && !dto.trainerId) {
      throw new BadRequestException('trainerId is required when creating plan as admin');
    }
    
    // If user is TRAINER, trainerId should not be provided (will use current user)
    if (user.role === 'TRAINER' && dto.trainerId) {
      throw new BadRequestException('trainerId cannot be provided when creating plan as trainer');
    }
    
    return this.plansService.createPlan(user.sub, dto);
  }

  @Get()
  @Roles('TRAINER', 'ADMIN')
  async getPlans(@CurrentUser() user: JwtPayload) {
    return this.plansService.getPlans(user.sub);
  }

  @Get(':id')
  @Roles('TRAINER', 'ADMIN', 'CLIENT')
  async getPlanById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.plansService.getPlanById(id, user.sub, user.role);
  }

  @Patch(':id')
  @Roles('TRAINER', 'ADMIN')
  async updatePlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.updatePlan(id, user.sub, user.role, dto);
  }

  @Delete(':id')
  @Roles('TRAINER', 'ADMIN')
  async deletePlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.plansService.deletePlan(id, user.sub, user.role);
    return { message: 'Plan deleted successfully' };
  }

  @Post(':id/assign')
  @Roles('TRAINER', 'ADMIN')
  async assignPlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignPlanDto,
  ) {
    AppLogger.logOperation('CONTROLLER_PLAN_ASSIGN', {
      userId: user.sub,
      userRole: user.role,
      planId: id,
      clientIds: dto.clientIds,
      startDate: dto.startDate,
    }, 'info');
    
    return this.plansService.assignPlanToClients(id, user.sub, user.role, dto);
  }

  @Post(':id/duplicate')
  @Roles('TRAINER', 'ADMIN')
  async duplicatePlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.plansService.duplicatePlan(id, user.sub, user.role);
  }

  @Post(':id/cancel/:clientId')
  @Roles('TRAINER', 'ADMIN')
  @ApiOperation({ summary: 'Cancel plan assignment for a client' })
  @ApiResponse({ status: 200, description: 'Plan cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel - has active workout logs' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async cancelPlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') planId: string,
    @Param('clientId') clientId: string,
  ) {
    await this.plansService.cancelPlan(planId, clientId, user.sub, user.role);
    return { message: 'Plan cancelled successfully' };
  }

  @Get('unlock-next-week/:clientId')
  @Roles('TRAINER', 'ADMIN', 'CLIENT')
  @ApiOperation({ summary: 'Check if client can unlock next week' })
  @ApiResponse({ status: 200, description: 'Returns whether next week can be unlocked' })
  async canUnlockNextWeek(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
  ) {
    AppLogger.logOperation('CONTROLLER_CAN_UNLOCK_CHECK', {
      userId: user.sub,
      userRole: user.role,
      clientIdParam: clientId,
    }, 'info');
    
    // If user is CLIENT, use their userId to get clientProfileId
    let clientProfileId = clientId;
    if (user.role === 'CLIENT') {
      // For CLIENT role, clientId param might be userId, convert to clientProfileId
      try {
        const client = await this.plansService['clientsService'].getProfile(user.sub);
        clientProfileId = (client as any)._id.toString();
        AppLogger.logOperation('CONTROLLER_CAN_UNLOCK_CLIENT_PROFILE_RESOLVED', {
          userId: user.sub,
          clientIdParam: clientId,
          clientProfileId,
        }, 'info');
      } catch (e) {
        // If not found, use the provided clientId (might already be clientProfileId)
        clientProfileId = clientId;
        AppLogger.logOperation('CONTROLLER_CAN_UNLOCK_CLIENT_PROFILE_NOT_FOUND', {
          userId: user.sub,
          clientIdParam: clientId,
          error: e instanceof Error ? e.message : String(e),
          usingClientIdParam: true,
        }, 'warn');
      }
    }
    
    AppLogger.logOperation('CONTROLLER_CAN_UNLOCK_CALLING_SERVICE', {
      clientProfileId,
    }, 'info');
    
    const canUnlock = await this.plansService.canUnlockNextWeek(clientProfileId);
    
    AppLogger.logOperation('CONTROLLER_CAN_UNLOCK_RESULT', {
      clientProfileId,
      canUnlock,
    }, 'info');
    
    return { canUnlock };
  }

  @Post('request-next-week/:clientId')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Request next week plan assignment' })
  @ApiResponse({ status: 200, description: 'Request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot request next week - current week not completed' })
  async requestNextWeek(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
  ) {
    // Get client profile ID from user.sub (CLIENT can only request for themselves)
    const client = await this.plansService['clientsService'].getProfile(user.sub);
    const clientProfileId = (client as any)._id.toString();
    
    // Validate that clientId parameter matches the authenticated user's client profile
    if (clientProfileId !== clientId) {
      throw new BadRequestException('You can only request next week for your own account');
    }
    
    AppLogger.logOperation('CONTROLLER_UNLOCK_REQUEST', {
      userId: user.sub,
      userRole: user.role,
      clientIdParam: clientId,
      clientProfileId,
    }, 'info');
    
    const result = await this.plansService.requestNextWeek(clientProfileId);
    
    AppLogger.logOperation('CONTROLLER_UNLOCK_RESPONSE', {
      clientProfileId,
      currentPlanId: result.currentPlanId,
      balance: result.balance,
      monthlyBalance: result.monthlyBalance,
    }, 'info');
    
    return {
      message: 'Next week request submitted successfully',
      currentPlanId: result.currentPlanId,
      balance: result.balance,
      monthlyBalance: result.monthlyBalance,
    };
  }
}

