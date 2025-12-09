import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIMessageService } from './ai-message.service';
import { PlanEffectiveness, PlanEffectivenessSchema } from './schemas/plan-effectiveness.schema';
import { AIMessage, AIMessageSchema } from './schemas/ai-message.schema';
import { ClientsModule } from '../clients/clients.module';
import { WorkoutsModule } from '../workouts/workouts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlanEffectiveness.name, schema: PlanEffectivenessSchema },
      { name: AIMessage.name, schema: AIMessageSchema },
    ]),
    ClientsModule,
    forwardRef(() => WorkoutsModule),
  ],
  providers: [AIMessageService],
  exports: [AIMessageService],
})
export class AIModule {}

