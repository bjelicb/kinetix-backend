import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SaasKillswitchGuard } from '../common/guards/saas-killswitch.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MonthlyInvoice, MonthlyInvoiceDocument } from './schemas/monthly-invoice.schema';

@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly clientsService: ClientsService,
    private readonly trainersService: TrainersService,
    @InjectModel(MonthlyInvoice.name)
    private invoiceModel: Model<MonthlyInvoiceDocument>,
  ) {}

  @Post('generate-invoice')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  @ApiOperation({ summary: 'Generate monthly invoice for client' })
  @ApiResponse({ status: 200, description: 'Invoice already exists for this month' })
  @ApiResponse({ status: 201, description: 'Invoice generated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid month' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Client role required or subscription inactive' })
  async generateInvoice(
    @Body() dto: GenerateInvoiceDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    // Convert ISO date string to Date
    const monthDate = new Date(dto.month);
    
    if (isNaN(monthDate.getTime())) {
      throw new ForbiddenException('Invalid month date format');
    }

    // Generate invoice for current user (CLIENT)
    const result = await this.paymentsService.generateMonthlyInvoice(user.sub, monthDate);
    
    // If invoice is new, return 201, otherwise 200
    // Wrap in TransformInterceptor format manually since we're using @Res()
    const responseData = {
      success: true,
      data: result.invoice,
      timestamp: new Date().toISOString(),
    };
    
    if (result.isNew) {
      return res.status(HttpStatus.CREATED).json(responseData);
    } else {
      return res.status(HttpStatus.OK).json(responseData);
    }
  }

  @Get('invoice/:clientId/:month')
  @Roles(UserRole.CLIENT, UserRole.TRAINER, UserRole.ADMIN)
  @UseGuards(SaasKillswitchGuard)
  @ApiOperation({ summary: 'Get monthly invoice for a client' })
  @ApiParam({ name: 'clientId', description: 'Client user ID (User._id)' })
  @ApiParam({ name: 'month', description: 'Month as ISO date string (e.g., "2025-01-15T00:00:00.000Z")' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Cannot access this invoice' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(
    @Param('clientId') clientId: string,
    @Param('month') month: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Convert ISO date string to Date
    const monthDate = new Date(month);
    
    if (isNaN(monthDate.getTime())) {
      throw new ForbiddenException('Invalid month date format');
    }

    // RBAC provera: CLIENT može samo svoj invoice
    // Normalize strings for comparison (trim and convert to string)
    if (user.role === UserRole.CLIENT) {
      const normalizedSub = String(user.sub).trim();
      const normalizedClientId = String(clientId).trim();
      if (normalizedSub !== normalizedClientId) {
        throw new ForbiddenException('You can only access your own invoices');
      }
    }

    // RBAC provera: TRAINER može invoice-e svojih klijenata
    // Do this before invoice lookup to prevent information leakage
    if (user.role === UserRole.TRAINER) {
      try {
        const trainer = await this.trainersService.getProfile(user.sub);
        const trainerProfileId = (trainer as any)._id.toString();
        
        // Check if client belongs to this trainer
        // clientId is User._id, so we can get ClientProfile directly
        const client = await this.clientsService.getProfile(clientId);
        
        // Extract trainerId from populated object or ObjectId
        let clientTrainerId: string | null = null;
        const trainerIdField = (client as any).trainerId;
        if (trainerIdField) {
          if (typeof trainerIdField === 'string') {
            clientTrainerId = trainerIdField;
          } else if (trainerIdField._id) {
            clientTrainerId = trainerIdField._id.toString();
          } else if (trainerIdField.toString && typeof trainerIdField.toString === 'function') {
            const str = trainerIdField.toString();
            clientTrainerId = str === '[object Object]' ? null : str;
          }
        }
        
        if (!clientTrainerId || clientTrainerId !== trainerProfileId) {
          throw new ForbiddenException('You can only access invoices of your clients');
        }
      } catch (error) {
        // If client not found or other error, throw ForbiddenException for security
        if (error instanceof NotFoundException) {
          throw new ForbiddenException('Client not found or access denied');
        }
        // Re-throw other errors (they will be handled by global exception filter)
        throw error;
      }
    }

    // ADMIN može sve - no additional check needed

    // Get invoice - handle all errors properly
    try {
      const invoice = await this.paymentsService.getMonthlyInvoice(clientId, monthDate);
      
      if (!invoice) {
        throw new NotFoundException('Invoice not found for this month');
      }

      return invoice;
    } catch (error) {
      // If getMonthlyInvoice throws NotFoundException (client doesn't exist),
      // convert to appropriate error based on role
      if (error instanceof NotFoundException) {
        // For CLIENT accessing their own ID, return 404 (invoice not found)
        // For TRAINER, we already checked client exists, so this is invoice not found
        // For ADMIN, return 404 (invoice not found)
        throw new NotFoundException('Invoice not found for this month');
      }
      // Re-throw other errors (they will be handled by global exception filter)
      throw error;
    }
  }

  @Patch('invoice/:id/paid')
  @Roles(UserRole.CLIENT)
  @UseGuards(SaasKillswitchGuard)
  @ApiOperation({ summary: 'Mark invoice as paid' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice marked as paid successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Cannot pay this invoice' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async markInvoiceAsPaid(
    @Param('id') invoiceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // RBAC provera: CLIENT može samo svoj invoice
    const invoice = await this.invoiceModel.findById(invoiceId).exec();
    
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const client = await this.clientsService.getProfile(user.sub);
    const clientProfileId = (client as any)._id.toString();
    const invoiceClientId = invoice.clientId.toString();

    if (clientProfileId !== invoiceClientId) {
      throw new ForbiddenException('You can only pay your own invoices');
    }

    // Mark invoice as paid (this will also clear client balance)
    return this.paymentsService.markInvoiceAsPaid(invoiceId);
  }
}