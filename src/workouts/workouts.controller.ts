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
import { TrainersService } from '../trainers/trainers.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SaasKillswitchGuard } from '../common/guards/saas-killswitch.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AppLogger } from '../common/utils/logger.utils';

@ApiTags('workouts')
@ApiBearerAuth('JWT-auth')
@Controller('workouts')
@UseGuards(JwtAuthGuard, RolesGuard, SaasKillswitchGuard)
export class WorkoutsController {
  constructor(
    private workoutsService: WorkoutsService,
    private trainersService: TrainersService,
  ) {}

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
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkoutLogDto,
  ) {
    return this.workoutsService.updateWorkoutLog(id, dto, user.sub);
  }

  @Get('today')
  @Roles('CLIENT')
  async getTodayWorkout(@CurrentUser() user: JwtPayload) {
    return this.workoutsService.getTodayWorkout(user.sub);
  }

  @Get(':id')
  @Roles('CLIENT')
  async getWorkoutById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.workoutsService.getWorkoutById(id, user.sub);
  }

  @Get('week/:date')
  @Roles('CLIENT', 'ADMIN')
  async getWeekWorkouts(
    @CurrentUser() user: JwtPayload,
    @Param('date') date: string,
  ) {
    const dateObj = new Date(date);
    return this.workoutsService.getWeekWorkouts(user.sub, dateObj);
  }

  @Get('trainer/clients/:clientId/analytics')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Get analytics data for a specific client (Trainer view)' })
  @ApiParam({ name: 'clientId', description: 'Client profile ID' })
  @ApiResponse({ status: 200, description: 'Analytics data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client does not belong to trainer' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getClientAnalyticsForTrainer(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientProfileId: string,
  ) {
    AppLogger.logOperation('ANALYTICS_ENDPOINT_START', {
      trainerId: user.sub,
      clientProfileId,
    }, 'info');

    // ✅ DATA ISOLATION: Verify client belongs to trainer
    // This ensures trainers can only access their own clients' data
    await this.trainersService.verifyClientBelongsToTrainer(user.sub, clientProfileId);
    AppLogger.logOperation('ANALYTICS_DATA_ISOLATION_VERIFIED', {
      trainerId: user.sub,
      clientProfileId,
    }, 'debug');

    // ✅ BUSINESS LOGIC: Get analytics from service (separation of concerns)
    const analytics = await this.workoutsService.getClientAnalytics(clientProfileId);

    AppLogger.logOperation('ANALYTICS_ENDPOINT_COMPLETE', {
      trainerId: user.sub,
      clientProfileId,
      totalWorkouts: analytics.totalWorkouts,
      completedWorkouts: analytics.completedWorkouts,
      overallAdherence: analytics.overallAdherence,
    }, 'info');

    // ✅ RESPONSE FORMAT: TransformInterceptor will wrap this automatically
    // Return analytics object directly (no manual wrapping needed)
    return analytics;
  }

  @Get('trainer/clients/:clientId/workouts')
  @Roles('TRAINER')
  @ApiOperation({ summary: 'Get all workouts for a specific client (Trainer only)' })
  @ApiParam({ name: 'clientId', description: 'Client profile ID' })
  @ApiResponse({ status: 200, description: 'Workouts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client does not belong to trainer' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getClientWorkoutsForTrainer(
    @CurrentUser() user: JwtPayload,
    @Param('clientId') clientProfileId: string,
  ) {
    // Verify client belongs to trainer
    await this.trainersService.verifyClientBelongsToTrainer(user.sub, clientProfileId);

    // Get all workout logs for client
    return this.workoutsService.getAllWorkoutLogsEnriched(clientProfileId);
  }
}

