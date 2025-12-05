import { CreateUserDto } from '../../users/dto/create-user.dto';
import { IsMongoId, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto extends CreateUserDto {
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'Trainer ID (required for CLIENT role)' })
  @IsMongoId()
  @IsOptional()
  trainerId?: string; // Required for CLIENT role, optional for others
}
