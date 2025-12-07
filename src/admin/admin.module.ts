import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  ClientProfile,
  ClientProfileSchema,
} from '../clients/schemas/client-profile.schema';
import {
  TrainerProfile,
  TrainerProfileSchema,
} from '../trainers/schemas/trainer-profile.schema';
import { CheckIn, CheckInSchema } from '../checkins/schemas/checkin.schema';
import { WeeklyPlan, WeeklyPlanSchema } from '../plans/schemas/weekly-plan.schema';
import { WorkoutLog, WorkoutLogSchema } from '../workouts/schemas/workout-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ClientProfile.name, schema: ClientProfileSchema },
      { name: TrainerProfile.name, schema: TrainerProfileSchema },
      { name: CheckIn.name, schema: CheckInSchema },
      { name: WeeklyPlan.name, schema: WeeklyPlanSchema },
      { name: WorkoutLog.name, schema: WorkoutLogSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
