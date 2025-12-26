import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CheckInsService } from './checkins.service';
import { WeighInService } from './weighin.service';
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
  constructor(
    private readonly checkInsService: CheckInsService,
    private readonly weighInService: WeighInService,
  ) {}

  @Post()
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  async createCheckIn(
    @CurrentUser() user: JwtPayload,
    @Body() createCheckInDto: CreateCheckInDto,
  ) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[CheckInsController] POST /checkins - CREATE CHECK-IN REQUEST');
    console.log('[CheckInsController] Timestamp:', new Date().toISOString());
    console.log('[CheckInsController] Client ID (userId):', user.sub);
    console.log('[CheckInsController] Request data:', {
      checkinDate: createCheckInDto.checkinDate,
      photoUrl: createCheckInDto.photoUrl ? 'PROVIDED' : 'NULL',
      photoUrlLength: createCheckInDto.photoUrl?.length || 0,
      gpsCoordinates: createCheckInDto.gpsCoordinates ? 'PROVIDED' : 'NULL',
      thumbnailUrl: createCheckInDto.thumbnailUrl ? 'PROVIDED' : 'NULL',
    });
    console.log('[CheckInsController] ════════════════════════════════════════');
    
    const result = await this.checkInsService.createCheckIn(user.sub, createCheckInDto);
    
    console.log('[CheckInsController] ✅ CHECK-IN CREATED SUCCESSFULLY');
    console.log('[CheckInsController] Check-in ID:', (result as any)._id || (result as any).id);
    console.log('[CheckInsController] Check-in date:', (result as any).checkinDate);
    console.log('[CheckInsController] Photo URL:', (result as any).photoUrl ? 'PROVIDED' : 'NULL');
    console.log('[CheckInsController] Verification Status:', (result as any).verificationStatus);
    console.log('[CheckInsController] ════════════════════════════════════════');
    
    return result;
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

  // Weigh-in endpoints
  @Post('weigh-in')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  @ApiOperation({ summary: 'Record weigh-in (can be any day, Monday recommended)' })
  @ApiResponse({ status: 201, description: 'Weigh-in recorded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - weigh-in already exists for this date' })
  async createWeighIn(
    @CurrentUser() user: JwtPayload,
    @Body() body: { weight: number; date?: string; photoUrl?: string; notes?: string; planId?: string },
  ) {
    const date = body.date ? new Date(body.date) : undefined;
    return this.weighInService.createWeighIn(
      user.sub,
      body.weight,
      date,
      body.photoUrl,
      body.notes,
      body.planId,
    );
  }

  @Get('weigh-in/history')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  @ApiOperation({ summary: 'Get weigh-in history' })
  async getWeighInHistory(@CurrentUser() user: JwtPayload) {
    return this.weighInService.getWeighInHistory(user.sub);
  }

  @Get('weigh-in/latest')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  @ApiOperation({ summary: 'Get latest weigh-in' })
  async getLatestWeighIn(@CurrentUser() user: JwtPayload) {
    return this.weighInService.getLatestWeighIn(user.sub);
  }
}

