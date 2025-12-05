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
  @Roles('TRAINER')
  async createPlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePlanDto,
  ) {
    return this.plansService.createPlan(user.sub, dto);
  }

  @Get()
  @Roles('TRAINER')
  async getPlans(@CurrentUser() user: JwtPayload) {
    return this.plansService.getPlans(user.sub);
  }

  @Get(':id')
  @Roles('TRAINER')
  async getPlanById(@Param('id') id: string) {
    return this.plansService.getPlanById(id);
  }

  @Patch(':id')
  @Roles('TRAINER')
  async updatePlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.updatePlan(id, user.sub, dto);
  }

  @Delete(':id')
  @Roles('TRAINER')
  async deletePlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.plansService.deletePlan(id, user.sub);
    return { message: 'Plan deleted successfully' };
  }

  @Post(':id/assign')
  @Roles('TRAINER')
  async assignPlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignPlanDto,
  ) {
    return this.plansService.assignPlanToClients(id, user.sub, dto);
  }

  @Post(':id/duplicate')
  @Roles('TRAINER')
  async duplicatePlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.plansService.duplicatePlan(id, user.sub);
  }
}

