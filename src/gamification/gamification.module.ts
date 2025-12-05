import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { PenaltyRecord, PenaltyRecordSchema } from './schemas/penalty-record.schema';
import { WeeklyPenaltyJob } from './jobs/weekly-penalty.job';
import { CommonModule } from '../common/common.module';
import { ClientsModule } from '../clients/clients.module';
import { TrainersModule } from '../trainers/trainers.module';
import { ClientProfile, ClientProfileSchema } from '../clients/schemas/client-profile.schema';
import { WorkoutLog, WorkoutLogSchema } from '../workouts/schemas/workout-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PenaltyRecord.name, schema: PenaltyRecordSchema },
      { name: ClientProfile.name, schema: ClientProfileSchema },
      { name: WorkoutLog.name, schema: WorkoutLogSchema },
    ]),
    ScheduleModule.forRoot(),
    CommonModule,
    ClientsModule,
    TrainersModule,
  ],
  controllers: [GamificationController],
  providers: [GamificationService, WeeklyPenaltyJob],
  exports: [GamificationService],
})
export class GamificationModule {}

