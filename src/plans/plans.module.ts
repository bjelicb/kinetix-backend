import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { WeeklyPlan, WeeklyPlanSchema } from './schemas/weekly-plan.schema';
import { TrainerProfile, TrainerProfileSchema } from '../trainers/schemas/trainer-profile.schema';
import { ClientProfile, ClientProfileSchema } from '../clients/schemas/client-profile.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { TrainersModule } from '../trainers/trainers.module';
import { ClientsModule } from '../clients/clients.module';
import { WorkoutsModule } from '../workouts/workouts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WeeklyPlan.name, schema: WeeklyPlanSchema },
      { name: TrainerProfile.name, schema: TrainerProfileSchema },
      { name: ClientProfile.name, schema: ClientProfileSchema },
      { name: User.name, schema: UserSchema },
    ]),
    TrainersModule,
    forwardRef(() => ClientsModule),
    forwardRef(() => WorkoutsModule),
  ],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}

