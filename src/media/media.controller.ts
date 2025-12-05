import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SaasKillswitchGuard } from '../common/guards/saas-killswitch.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('media')
@ApiBearerAuth('JWT-auth')
@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard, SaasKillswitchGuard)
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Get('signature')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get Cloudinary upload signature for direct upload' })
  @ApiResponse({ status: 200, description: 'Upload signature generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async getUploadSignature(@CurrentUser() user: JwtPayload) {
    return this.mediaService.getUploadSignature(user.sub);
  }
}

