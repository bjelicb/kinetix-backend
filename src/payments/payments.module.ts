import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsService } from './payments.service';
import { ClientPayment, ClientPaymentSchema } from './schemas/client-payment.schema';
import { MonthlyInvoice, MonthlyInvoiceSchema } from './schemas/monthly-invoice.schema';
import { ClientsModule } from '../clients/clients.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClientPayment.name, schema: ClientPaymentSchema },
      { name: MonthlyInvoice.name, schema: MonthlyInvoiceSchema },
    ]),
    ClientsModule,
    forwardRef(() => GamificationModule),
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

