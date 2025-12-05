import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SaasKillswitchGuard } from '../common/guards/saas-killswitch.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('status')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  async getPenaltyStatus(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getPenaltyStatus(user.sub);
  }

  @Get('penalties')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  async getPenaltyHistory(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getPenaltyHistory(user.sub);
  }

  @Get('leaderboard')
  @Roles(UserRole.TRAINER)
  async getLeaderboard(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getLeaderboard(user.sub);
  }

  @Post('reset-penalty/:clientId')
  @Roles(UserRole.TRAINER)
  async resetPenalty(
    @Param('clientId') clientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.gamificationService.resetPenalty(clientId, user.sub);
    return { message: 'Penalty reset successfully' };
  }
}

