import { Module, forwardRef } from '@nestjs/common';
import { SaasKillswitchGuard } from './guards/saas-killswitch.guard';
import { ClientsModule } from '../clients/clients.module';
import { TrainersModule } from '../trainers/trainers.module';

@Module({
  imports: [
    forwardRef(() => ClientsModule),
    forwardRef(() => TrainersModule),
  ],
  providers: [SaasKillswitchGuard],
  exports: [SaasKillswitchGuard],
})
export class CommonModule {}

