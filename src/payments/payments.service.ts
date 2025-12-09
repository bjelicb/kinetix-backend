import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClientPayment, ClientPaymentDocument } from './schemas/client-payment.schema';
import { MonthlyInvoice, MonthlyInvoiceDocument } from './schemas/monthly-invoice.schema';
import { ClientsService } from '../clients/clients.service';
import { GamificationService } from '../gamification/gamification.service';
import { InvoiceStatus } from './schemas/monthly-invoice.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(ClientPayment.name) private paymentModel: Model<ClientPaymentDocument>,
    @InjectModel(MonthlyInvoice.name) private invoiceModel: Model<MonthlyInvoiceDocument>,
    private clientsService: ClientsService,
    @Inject(forwardRef(() => GamificationService))
    private gamificationService: GamificationService,
  ) {}

  /**
   * Generate monthly invoice for a client
   * Called at the end of each month
   */
  async generateMonthlyInvoice(clientId: string, month: Date): Promise<MonthlyInvoice> {
    const client = await this.clientsService.getProfile(clientId);
    const clientProfileId = (client as any)._id;

    // Check if invoice already exists for this month
    const existing = await this.invoiceModel.findOne({
      clientId: clientProfileId,
      month: new Date(month.getFullYear(), month.getMonth(), 1),
    }).exec();

    if (existing) {
      return existing;
    }

    // Calculate totals from penalty history
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);

    const penalties = (client.penaltyHistory || []).filter(p => {
      const penaltyDate = new Date(p.date);
      return penaltyDate >= monthStart && penaltyDate <= monthEnd && p.reason === 'Missed workout';
    });

    const planCosts = (client.penaltyHistory || []).filter(p => {
      const penaltyDate = new Date(p.date);
      return penaltyDate >= monthStart && penaltyDate <= monthEnd && p.reason === 'Weekly plan cost';
    });

    const totalPenalties = penalties.reduce((sum, p) => sum + p.amount, 0);
    const totalPlanCosts = planCosts.reduce((sum, p) => sum + p.amount, 0);
    const totalBalance = totalPenalties + totalPlanCosts;

    const invoice = new this.invoiceModel({
      clientId: clientProfileId,
      month: monthStart,
      totalBalance,
      planCosts: totalPlanCosts,
      penalties: totalPenalties,
      status: InvoiceStatus.UNPAID,
      dueDate: monthEnd,
    });

    return invoice.save();
  }

  /**
   * Get monthly invoice for a client
   */
  async getMonthlyInvoice(clientId: string, month: Date): Promise<MonthlyInvoice | null> {
    const client = await this.clientsService.getProfile(clientId);
    const clientProfileId = (client as any)._id;

    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);

    return this.invoiceModel.findOne({
      clientId: clientProfileId,
      month: monthStart,
    }).exec();
  }

  /**
   * Mark invoice as paid
   */
  async markInvoiceAsPaid(invoiceId: string): Promise<MonthlyInvoice> {
    const invoice = await this.invoiceModel.findByIdAndUpdate(
      invoiceId,
      {
        $set: {
          status: InvoiceStatus.PAID,
          paidAt: new Date(),
        },
      },
      { new: true },
    ).exec();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Clear client's balance
    await this.gamificationService.clearBalance(invoice.clientId);

    return invoice;
  }
}

