import { IsEnum, IsString, IsOptional, IsObject } from 'class-validator';
import { AIMessageTrigger } from '../schemas/ai-message.schema';

export class GenerateMessageDto {
  @IsString()
  clientId: string;

  @IsEnum(AIMessageTrigger)
  trigger: AIMessageTrigger;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

