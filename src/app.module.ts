import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TrainersModule } from './trainers/trainers.module';
import { ClientsModule } from './clients/clients.module';
import { PlansModule } from './plans/plans.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { MediaModule } from './media/media.module';
import { CheckInsModule } from './checkins/checkins.module';
import { TrainingModule } from './training/training.module';
import { GamificationModule } from './gamification/gamification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // U test okruženju, povećavamo limit ili ga onemogućavamo
        const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
        return [{
          ttl: 60000, // 1 minuta
          limit: isTest ? 10000 : 10,  // 10000 zahteva u testu, 10 u produkciji
        }];
      },
      inject: [ConfigService],
    }),
    // Feature Modules
    AuthModule,
    UsersModule,
    TrainersModule,
    ClientsModule,
    PlansModule,
    WorkoutsModule,
    MediaModule,
    CheckInsModule,
    TrainingModule,
    GamificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
