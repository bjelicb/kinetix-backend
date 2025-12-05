import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { WorkoutsService } from './workouts.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SaasKillswitchGuard } from '../common/guards/saas-killswitch.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('workouts')
@ApiBearerAuth('JWT-auth')
@Controller('workouts')
@UseGuards(JwtAuthGuard, RolesGuard, SaasKillswitchGuard)
export class WorkoutsController {
  constructor(private workoutsService: WorkoutsService) {}

  @Post('log')
  @Roles('CLIENT')
  async logWorkout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: LogWorkoutDto,
  ) {
    return this.workoutsService.logWorkout(user.sub, dto);
  }

  @Patch(':id')
  @Roles('CLIENT')
  async updateWorkoutLog(
    @Param('id') id: string,
    @Body() dto: UpdateWorkoutLogDto,
  ) {
    return this.workoutsService.updateWorkoutLog(id, dto);
  }

  @Get('today')
  @Roles('CLIENT')
  async getTodayWorkout(@CurrentUser() user: JwtPayload) {
    return this.workoutsService.getTodayWorkout(user.sub);
  }

  @Get(':id')
  @Roles('CLIENT')
  async getWorkoutById(@Param('id') id: string) {
    return this.workoutsService.getWorkoutById(id);
  }

  @Get('week/:date')
  @Roles('CLIENT')
  async getWeekWorkouts(
    @CurrentUser() user: JwtPayload,
    @Param('date') date: string,
  ) {
    const dateObj = new Date(date);
    return this.workoutsService.getWeekWorkouts(user.sub, dateObj);
  }
}

