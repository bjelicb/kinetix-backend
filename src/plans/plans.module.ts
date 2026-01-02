import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { WeeklyPlan, WeeklyPlanSchema } from './schemas/weekly-plan.schema';
import { TrainerProfile, TrainerProfileSchema } from '../trainers/schemas/trainer-profile.schema';
import { ClientProfile, ClientProfileSchema } from '../clients/schemas/client-profile.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WorkoutLog, WorkoutLogSchema } from '../workouts/schemas/workout-log.schema';
import { TrainersModule } from '../trainers/trainers.module';
import { ClientsModule } from '../clients/clients.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WeeklyPlan.name, schema: WeeklyPlanSchema },
      { name: TrainerProfile.name, schema: TrainerProfileSchema },
      { name: ClientProfile.name, schema: ClientProfileSchema },
      { name: User.name, schema: UserSchema },
      { name: WorkoutLog.name, schema: WorkoutLogSchema },
    ]),
    forwardRef(() => TrainersModule),
    forwardRef(() => ClientsModule),
    forwardRef(() => WorkoutsModule),
    forwardRef(() => GamificationModule),
  ],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}

