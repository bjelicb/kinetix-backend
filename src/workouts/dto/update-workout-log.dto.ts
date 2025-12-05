import { PartialType } from '@nestjs/mapped-types';
import { LogWorkoutDto } from './log-workout.dto';

export class UpdateWorkoutLogDto extends PartialType(LogWorkoutDto) {}

