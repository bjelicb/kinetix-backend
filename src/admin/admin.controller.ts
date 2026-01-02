import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AssignClientDto } from './dto/assign-client.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('/users')
  @ApiOperation({ summary: 'Get all users with trainer information' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('/stats')
  @ApiOperation({ summary: 'Get system statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Post('/assign-client')
  @HttpCode(200)
  @ApiOperation({ summary: 'Assign a client to a trainer' })
  @ApiResponse({ status: 200, description: 'Client assigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Client or trainer not found' })
  async assignClient(@Body() dto: AssignClientDto) {
    return this.adminService.assignClientToTrainer(dto);
  }

  @Get('/plans')
  @ApiOperation({ summary: 'Get all plans across all trainers' })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getAllPlans() {
    return this.adminService.getAllPlans();
  }

  @Get('/workouts/all')
  @ApiOperation({ summary: 'Get all workout logs across all clients' })
  @ApiResponse({ status: 200, description: 'Workouts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getAllWorkouts() {
    return this.adminService.getAllWorkouts();
  }

  @Get('/workouts/stats')
  @ApiOperation({ summary: 'Get workout statistics' })
  @ApiResponse({ status: 200, description: 'Workout statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getWorkoutStats() {
    return this.adminService.getWorkoutStats();
  }

  @Patch('/users/:id')
  @ApiOperation({ summary: 'Update user details' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('/users/:id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Cannot delete admin users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Patch('/users/:id/status')
  @ApiOperation({ summary: 'Update user status (suspend/activate)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, dto);
  }

  @Patch('/workouts/:id/status')
  @ApiOperation({ summary: 'Update workout status (mark as completed/missed)' })
  @ApiParam({ name: 'id', description: 'Workout log ID' })
  @ApiResponse({ status: 200, description: 'Workout status updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Workout not found' })
  async updateWorkoutStatus(
    @Param('id') id: string,
    @Body() body: { isCompleted?: boolean; isMissed?: boolean },
  ) {
    return this.adminService.updateWorkoutStatus(id, body);
  }

  @Delete('/workouts/:id')
  @ApiOperation({ summary: 'Delete a workout log' })
  @ApiParam({ name: 'id', description: 'Workout log ID' })
  @ApiResponse({ status: 200, description: 'Workout deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Workout not found' })
  async deleteWorkout(@Param('id') id: string) {
    return this.adminService.deleteWorkout(id);
  }
}
