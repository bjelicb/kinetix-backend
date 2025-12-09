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
  @Roles('TRAINER', 'ADMIN')
  async getPlanById(@Param('id') id: string) {
    return this.plansService.getPlanById(id);
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

  @Get('unlock-next-week/:clientId')
  @Roles('TRAINER', 'ADMIN', 'CLIENT')
  @ApiOperation({ summary: 'Check if client can unlock next week' })
  @ApiResponse({ status: 200, description: 'Returns whether next week can be unlocked' })
  async canUnlockNextWeek(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientId: string,
  ) {
    // If user is CLIENT, use their userId to get clientProfileId
    let clientProfileId = clientId;
    if (user.role === 'CLIENT') {
      // For CLIENT role, clientId param might be userId, convert to clientProfileId
      try {
        const client = await this.plansService['clientsService'].getProfile(user.sub);
        clientProfileId = (client as any)._id.toString();
      } catch {
        // If not found, use the provided clientId (might already be clientProfileId)
        clientProfileId = clientId;
      }
    }
    
    const canUnlock = await this.plansService.canUnlockNextWeek(clientProfileId);
    return { canUnlock };
  }
}

