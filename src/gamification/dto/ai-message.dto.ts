import { AIMessageTone, AIMessageTrigger } from '../schemas/ai-message.schema';

export class AIMessageDto {
  id: string;
  clientId: string;
  message: string;
  tone: AIMessageTone;
  trigger: AIMessageTrigger;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

