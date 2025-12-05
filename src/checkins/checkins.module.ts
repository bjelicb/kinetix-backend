import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CheckInsService } from './checkins.service';
import { CheckInsController } from './checkins.controller';
import { CheckIn, CheckInSchema } from './schemas/checkin.schema';
import { CommonModule } from '../common/common.module';
import { ClientsModule } from '../clients/clients.module';
import { TrainersModule } from '../trainers/trainers.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CheckIn.name, schema: CheckInSchema }]),
    CommonModule,
    ClientsModule,
    TrainersModule,
  ],
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}

