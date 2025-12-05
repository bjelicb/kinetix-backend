import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import {
  ClientProfile,
  ClientProfileSchema,
} from './schemas/client-profile.schema';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';
import { TrainersModule } from '../trainers/trainers.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClientProfile.name, schema: ClientProfileSchema },
    ]),
    forwardRef(() => CommonModule),
    UsersModule,
    TrainersModule,
    forwardRef(() => WorkoutsModule),
    forwardRef(() => PlansModule),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}

