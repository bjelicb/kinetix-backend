import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { TrainersService } from './trainers.service';
import { TrainersController } from './trainers.controller';
import {
  TrainerProfile,
  TrainerProfileSchema,
} from './schemas/trainer-profile.schema';
import {
  ClientProfile,
  ClientProfileSchema,
} from '../clients/schemas/client-profile.schema';
import { UsersModule } from '../users/users.module';
import { SubscriptionChecker } from './jobs/subscription-checker.job';
import { PenaltyRecord, PenaltyRecordSchema } from '../gamification/schemas/penalty-record.schema';
import { Appointment, AppointmentSchema } from './schemas/appointment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrainerProfile.name, schema: TrainerProfileSchema },
      { name: ClientProfile.name, schema: ClientProfileSchema },
      { name: PenaltyRecord.name, schema: PenaltyRecordSchema },
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
    ScheduleModule.forRoot(),
    UsersModule,
  ],
  controllers: [TrainersController],
  providers: [TrainersService, SubscriptionChecker],
  exports: [TrainersService],
})
export class TrainersModule {}

