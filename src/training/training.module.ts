import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';
import { CommonModule } from '../common/common.module';
import { ClientsModule } from '../clients/clients.module';
import { TrainersModule } from '../trainers/trainers.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { CheckInsModule } from '../checkins/checkins.module';
import { WorkoutLog, WorkoutLogSchema } from '../workouts/schemas/workout-log.schema';
import { CheckIn, CheckInSchema } from '../checkins/schemas/checkin.schema';
import { WeeklyPlan, WeeklyPlanSchema } from '../plans/schemas/weekly-plan.schema';

@Module({
  imports: [
    CommonModule,
    ClientsModule,
    TrainersModule,
    WorkoutsModule,
    CheckInsModule,
    MongooseModule.forFeature([
      { name: WorkoutLog.name, schema: WorkoutLogSchema },
      { name: CheckIn.name, schema: CheckInSchema },
      { name: WeeklyPlan.name, schema: WeeklyPlanSchema },
    ]),
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}

