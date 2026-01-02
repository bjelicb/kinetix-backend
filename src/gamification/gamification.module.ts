import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { GamificationService } from './gamification.service';
import { AIMessageService } from './ai-message.service';
import { GamificationController } from './gamification.controller';
import { PenaltyRecord, PenaltyRecordSchema } from './schemas/penalty-record.schema';
import { AIMessage, AIMessageSchema } from './schemas/ai-message.schema';
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
      { name: AIMessage.name, schema: AIMessageSchema },
      { name: ClientProfile.name, schema: ClientProfileSchema },
      { name: WorkoutLog.name, schema: WorkoutLogSchema },
    ]),
    ScheduleModule.forRoot(),
    CommonModule,
    forwardRef(() => ClientsModule),
    forwardRef(() => TrainersModule),
  ],
  controllers: [GamificationController],
  providers: [GamificationService, AIMessageService, WeeklyPenaltyJob],
  exports: [GamificationService, AIMessageService],
})
export class GamificationModule {}

