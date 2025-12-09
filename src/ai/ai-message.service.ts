import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AIMessage, AIMessageDocument, MessageType } from './schemas/ai-message.schema';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';

@Injectable()
export class AIMessageService {
  constructor(
    @InjectModel(AIMessage.name) private messageModel: Model<AIMessageDocument>,
    private clientsService: ClientsService,
    private workoutsService: WorkoutsService,
  ) {}

  /**
   * Detect if client's performance is dropping
   * Analyzes workout logs for declining performance
   */
  async detectPerformanceDrop(clientId: string): Promise<boolean> {
    // TODO: Implement performance analysis
    // For now, return false (placeholder)
    // In V2, this will analyze:
    // - Weight progression (decreasing)
    // - Reps progression (decreasing)
    // - Completion rate (decreasing)
    // - Workout frequency (decreasing)
    return false;
  }

  /**
   * Generate AI message based on type and client context
   */
  async generateMessage(
    clientId: string,
    type: MessageType,
  ): Promise<string> {
    const client = await this.clientsService.getProfile(clientId);

    // Message templates (will be replaced with LLM in V2)
    const templates: Record<MessageType, string[]> = {
      [MessageType.PASSIVE_AGGRESSIVE]: [
        "Another missed workout? Your trainer is not impressed. Get back on track.",
        "Your consistency is slipping. Time to step up your game.",
        "Missing workouts won't get you results. Show up or pay up.",
      ],
      [MessageType.EMPATHY]: [
        "We understand you might be going through a tough time. Take care of yourself, but don't let this become a habit.",
        "If you're feeling unwell, rest is important. Let your trainer know when you're ready to get back on track.",
      ],
      [MessageType.MOTIVATION]: [
        "You're doing great! Keep pushing forward.",
        "Every workout counts. You've got this!",
      ],
      [MessageType.WARNING]: [
        "You're falling behind on your workouts. Time to refocus.",
        "Your trainer has noticed a drop in your activity. Let's turn this around.",
      ],
      [MessageType.PENALTY]: [
        "You've missed too many workouts. Penalty mode activated.",
        "Your lack of consistency has consequences. Time to pay the price.",
      ],
      [MessageType.CELEBRATION]: [
        "Amazing work this week! You're crushing your goals!",
        "Outstanding consistency! Your trainer is proud.",
      ],
    };

    const messages = templates[type] || templates[MessageType.MOTIVATION];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    // Save message to database
    const message = new this.messageModel({
      clientId: (client as any)._id,
      messageType: type,
      content: randomMessage,
      generatedAt: new Date(),
      trainerApproved: false, // For V2, trainer can review
    });

    await message.save();

    return randomMessage;
  }

  /**
   * Send push notification (placeholder for V2)
   */
  async sendPushNotification(clientId: string, message: string): Promise<void> {
    // TODO: Implement Firebase Cloud Messaging integration
    // For now, just log
    console.log(`[AIMessageService] Would send push notification to client ${clientId}: ${message}`);
  }
}

