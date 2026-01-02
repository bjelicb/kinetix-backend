import { IsEnum, IsString, IsOptional, IsObject, IsNotEmpty, IsMongoId } from 'class-validator';
import { AIMessageTrigger, AIMessageTone } from '../schemas/ai-message.schema';

export class GenerateMessageDto {
  @IsMongoId()
  @IsNotEmpty()
  clientId: string;

  @IsEnum(AIMessageTrigger)
  trigger: AIMessageTrigger;

  @IsOptional()
  @IsString()
  customMessage?: string;

  @IsOptional()
  @IsEnum(AIMessageTone)
  tone?: AIMessageTone;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

