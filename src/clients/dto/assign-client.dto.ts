import { IsMongoId, IsNotEmpty } from 'class-validator';

export class AssignClientDto {
  @IsMongoId()
  @IsNotEmpty()
  trainerId: string;
}

