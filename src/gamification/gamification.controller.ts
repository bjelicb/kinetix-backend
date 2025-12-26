import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { AIMessageService } from './ai-message.service';
import { ClientsService } from '../clients/clients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SaasKillswitchGuard } from '../common/guards/saas-killswitch.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { GenerateMessageDto } from './dto/generate-message.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gamification')
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly aiMessageService: AIMessageService,
    private readonly clientsService: ClientsService,
  ) {}

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

  @Get('balance')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  async getBalance(@CurrentUser() user: JwtPayload) {
    const client = await this.clientsService.getProfile(user.sub);
    
    return {
      balance: client.balance || 0,
      monthlyBalance: client.monthlyBalance || 0,
      lastBalanceReset: client.lastBalanceReset,
      penaltyHistory: client.penaltyHistory || [],
    };
  }

  @Post('clear-balance')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  async clearBalance(@CurrentUser() user: JwtPayload) {
    console.log(`[GamificationController] clearBalance START - userId: ${user.sub}`);
    const client = await this.clientsService.getProfile(user.sub);
    const clientProfileId = (client as any)._id;
    
    const balanceBefore = client.balance || 0;
    const monthlyBalanceBefore = client.monthlyBalance || 0;
    console.log(`[GamificationController] clearBalance - clientProfileId: ${clientProfileId}, balance before: ${balanceBefore}€, monthlyBalance before: ${monthlyBalanceBefore}€`);
    
    await this.gamificationService.clearBalance(clientProfileId);
    
    console.log(`[GamificationController] clearBalance SUCCESS - Balance cleared from ${balanceBefore}€ to 0€, monthlyBalance cleared from ${monthlyBalanceBefore}€ to 0€`);
    return { message: 'Balance cleared successfully' };
  }

  // AI Message System Endpoints
  
  @Post('generate-message')
  @Roles(UserRole.TRAINER, UserRole.ADMIN)
  async generateMessage(@Body() dto: GenerateMessageDto) {
    return this.aiMessageService.generateMessage(dto);
  }

  @Get('messages/all')
  @Roles(UserRole.ADMIN)
  async getAllMessages() {
    return this.aiMessageService.getAllMessages();
  }

  @Get('messages/:clientId')
  @Roles(UserRole.CLIENT, UserRole.TRAINER, UserRole.ADMIN)
  async getMessages(
    @Param('clientId') clientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // If client, can only see own messages
    if (user.role === UserRole.CLIENT) {
      const client = await this.clientsService.getProfile(user.sub);
      const clientProfileId = (client as any)._id.toString();
      if (clientProfileId !== clientId) {
        return { message: 'Forbidden' };
      }
    }
    
    return this.aiMessageService.getMessages(clientId);
  }

  @Patch('messages/:messageId/read')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  async markMessageAsRead(@Param('messageId') messageId: string) {
    await this.aiMessageService.markAsRead(messageId);
    return { message: 'Message marked as read' };
  }
}

