import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkoutsService } from './workouts.service';
import { WorkoutsController } from './workouts.controller';
import { WorkoutLog, WorkoutLogSchema } from './schemas/workout-log.schema';
import { CheckIn, CheckInSchema } from '../checkins/schemas/checkin.schema';
import { CommonModule } from '../common/common.module';
import { ClientsModule } from '../clients/clients.module';
import { TrainersModule } from '../trainers/trainers.module';
import { PlansModule } from '../plans/plans.module';
import { DailyWorkoutChecker } from './jobs/daily-workout-checker.job';
import { CleanupOldLogs } from './jobs/cleanup-old-logs.job';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkoutLog.name, schema: WorkoutLogSchema },
      { name: CheckIn.name, schema: CheckInSchema },
    ]),
    ScheduleModule.forRoot(),
    CommonModule,
    forwardRef(() => ClientsModule),
    TrainersModule,
    forwardRef(() => PlansModule),
  ],
  controllers: [WorkoutsController],
  providers: [WorkoutsService, DailyWorkoutChecker, CleanupOldLogs],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}

