import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncChangesResponseDto } from './dto/sync-changes-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SaasKillswitchGuard } from '../common/guards/saas-killswitch.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('training')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, SaasKillswitchGuard)
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('sync/changes')
  @Roles(UserRole.CLIENT, UserRole.TRAINER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all changes since last sync timestamp' })
  @ApiResponse({ status: 200, description: 'Returns updated workouts, plans, and check-ins', type: SyncChangesResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - subscription inactive' })
  async getSyncChanges(
    @CurrentUser() user: JwtPayload,
    @Query('since') since: string,
  ): Promise<SyncChangesResponseDto> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[TrainingController] getSyncChanges() START');
    console.log('[TrainingController] → User ID:', user.sub);
    console.log('[TrainingController] → User role:', user.role);
    console.log('[TrainingController] → Since:', since);
    
    const sinceDate = since ? new Date(since) : new Date(0); // Default to epoch if not provided
    console.log('[TrainingController] → Since date:', sinceDate);
    
    const result = await this.trainingService.getSyncChanges(user.sub, user.role, sinceDate);
    
    console.log('[TrainingController] ✓ Sync changes retrieved');
    console.log('[TrainingController] → Workouts:', result.workouts?.length || 0);
    console.log('[TrainingController] → Plans:', result.plans?.length || 0);
    console.log('[TrainingController] → CheckIns:', result.checkIns?.length || 0);
    console.log('═══════════════════════════════════════════════════════════');
    
    return result;
  }

  @Post('sync/batch')
  @Roles(UserRole.CLIENT, UserRole.TRAINER)
  @ApiOperation({ summary: 'Batch sync workout logs and check-ins from mobile app' })
  @ApiResponse({ status: 200, description: 'Sync completed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  @ApiResponse({ status: 409, description: 'Conflict - server version is newer' })
  async syncBatch(@CurrentUser() user: JwtPayload, @Body() syncBatchDto: SyncBatchDto) {
    return this.trainingService.syncBatch(user.sub, syncBatchDto);
  }
}

