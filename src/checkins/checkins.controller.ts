import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CheckInsService } from './checkins.service';
import { CreateCheckInDto } from './dto/create-checkin.dto';
import { VerifyCheckInDto } from './dto/verify-checkin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SaasKillswitchGuard } from '../common/guards/saas-killswitch.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('checkins')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('checkins')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  async createCheckIn(
    @CurrentUser() user: JwtPayload,
    @Body() createCheckInDto: CreateCheckInDto,
  ) {
    return this.checkInsService.createCheckIn(user.sub, createCheckInDto);
  }

  @Get()
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  async getCheckInsByClient(@CurrentUser() user: JwtPayload) {
    return this.checkInsService.getCheckInsByClient(user.sub);
  }

  @Get('pending')
  @Roles(UserRole.TRAINER)
  async getPendingCheckIns(@CurrentUser('sub') trainerId: string) {
    return this.checkInsService.getPendingCheckIns(trainerId);
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.TRAINER)
  async getCheckInById(@Param('id') id: string) {
    return this.checkInsService.getCheckInById(id);
  }

  @Patch(':id/verify')
  @Roles(UserRole.TRAINER)
  async verifyCheckIn(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() verifyCheckInDto: VerifyCheckInDto,
  ) {
    return this.checkInsService.verifyCheckIn(id, user.sub, verifyCheckInDto);
  }

  @Get('range/start/:startDate/end/:endDate')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  async getCheckInsByDateRange(
    @CurrentUser() user: JwtPayload,
    @Param('startDate') startDate: string,
    @Param('endDate') endDate: string,
  ) {
    return this.checkInsService.getCheckInsByDateRange(
      user.sub,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  @ApiOperation({ summary: 'Delete check-in' })
  @ApiParam({ name: 'id', description: 'Check-in ID' })
  @ApiResponse({ status: 200, description: 'Check-in deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only delete own check-ins' })
  @ApiResponse({ status: 404, description: 'Check-in not found' })
  async deleteCheckIn(
    @CurrentUser() user: JwtPayload,
    @Param('id') checkInId: string,
  ) {
    await this.checkInsService.deleteCheckIn(checkInId, user.sub);
    return { message: 'Check-in deleted successfully' };
  }
}

