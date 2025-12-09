import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SaasKillswitchGuard } from '../common/guards/saas-killswitch.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('clients')
@ApiBearerAuth('JWT-auth')
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard, SaasKillswitchGuard)
export class ClientsController {
  constructor(
    private clientsService: ClientsService,
    private workoutsService: WorkoutsService,
  ) {}

  @Get('profile')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get client profile' })
  @ApiResponse({ status: 200, description: 'Client profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.clientsService.getProfile(user.sub);
  }

  @Patch('profile')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Update client profile' })
  @ApiResponse({ status: 200, description: 'Client profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.updateProfile(user.sub, dto);
  }

  @Get('current-plan')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get current workout plan' })
  @ApiResponse({ status: 200, description: 'Current plan retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async getCurrentPlan(@CurrentUser() user: JwtPayload) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[ClientsController] getCurrentPlan() START');
    console.log('[ClientsController] → User ID:', user.sub);
    console.log('[ClientsController] → User role:', user.role);
    console.log('═══════════════════════════════════════════════════════════');
    
    const result = await this.clientsService.getCurrentPlan(user.sub);
    
    if (result) {
      console.log('[ClientsController] ✓ Plan found');
      console.log('[ClientsController] → Plan ID:', result._id || result.id);
      console.log('[ClientsController] → Plan name:', result.name);
    } else {
      console.log('[ClientsController] ✗ No plan found');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    return result;
  }

  @Get('plan-history')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get all plan history for the client' })
  @ApiResponse({ status: 200, description: 'Plan history retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async getPlanHistory(@CurrentUser() user: JwtPayload) {
    return this.clientsService.getPlanHistory(user.sub);
  }

  @Get('workouts/upcoming')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get upcoming workouts for the week' })
  @ApiResponse({ status: 200, description: 'Upcoming workouts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async getUpcomingWorkouts(@CurrentUser() user: JwtPayload) {
    const today = new Date();
    return this.workoutsService.getWeekWorkouts(user.sub, today);
  }

  @Get('workouts/history')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get workout history' })
  @ApiResponse({ status: 200, description: 'Workout history retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async getWorkoutHistory(@CurrentUser() user: JwtPayload) {
    return this.workoutsService.getWorkoutHistory(user.sub);
  }

  @Get('trainer')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get assigned trainer information' })
  @ApiResponse({ status: 200, description: 'Trainer information retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async getTrainer(@CurrentUser() user: JwtPayload) {
    const profile = await this.clientsService.getProfile(user.sub);
    // Convert trainerId ObjectId to string (handle both populated and non-populated cases)
    const trainerId = profile.trainerId 
      ? ((profile.trainerId as any)?._id 
          ? (profile.trainerId as any)._id.toString() 
          : (profile.trainerId as any).toString())
      : null;
    return { id: trainerId };
  }

  @Get('stats')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get client workout statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.clientsService.getStats(user.sub);
  }
}

