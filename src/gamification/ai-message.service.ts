import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AIMessage, AIMessageDocument, AIMessageTone, AIMessageTrigger } from './schemas/ai-message.schema';
import { GenerateMessageDto } from './dto/generate-message.dto';
import { AIMessageDto } from './dto/ai-message.dto';
import { AppLogger } from '../common/utils/logger.utils';

@Injectable()
export class AIMessageService {
  constructor(
    @InjectModel(AIMessage.name)
    private aiMessageModel: Model<AIMessageDocument>,
  ) {}

  /**
   * Message templates by tone
   */
  private readonly MESSAGE_TEMPLATES = {
    [AIMessageTone.AGGRESSIVE]: [
      '2 missed workouts this week? That\'s not discipline, that\'s excuses.',
      'Consistency is king. Your {missedCount} missed workouts say otherwise.',
      'You wanted results, not rest days. Get back on track.',
      'Missing {missedCount} workouts won\'t get you closer to your goals.',
    ],
    [AIMessageTone.EMPATHETIC]: [
      'Feeling sick? Take care of yourself. Recovery is part of training.',
      'Everyone has tough weeks. What matters is getting back on track.',
      'Your health comes first. Rest well and come back stronger.',
      'Not feeling 100%? That\'s okay. Listen to your body.',
    ],
    [AIMessageTone.MOTIVATIONAL]: [
      '7 days straight! You\'re unstoppable. Keep this energy!',
      '{streak} days of consistency! This is what champions do!',
      'You\'re crushing it! {streak} days without missing a beat!',
      'This is your week! {streak} days of pure dedication!',
    ],
    [AIMessageTone.WARNING]: [
      'Weight up {weightChange}kg this week? Time to explain what happened.',
      '{weightChange}kg increase detected. Let\'s have a conversation.',
      'Your weight jumped {weightChange}kg. What\'s going on?',
      'Significant weight change: +{weightChange}kg. Check-in needed.',
    ],
  };

  /**
   * Generate AI message based on trigger and client data
   */
  async generateMessage(dto: GenerateMessageDto): Promise<AIMessage> {
    AppLogger.logStart('AI_MESSAGE_GENERATE', {
      clientId: dto.clientId,
      trigger: dto.trigger,
    });

    try {
      // Analyze client data and select tone
      const tone = this.selectTone(dto.trigger, dto.metadata);
      
      AppLogger.logOperation('AI_MESSAGE_ANALYZE', {
        clientId: dto.clientId,
        trigger: dto.trigger,
        metadata: dto.metadata,
      }, 'debug');

      AppLogger.logOperation('AI_MESSAGE_TONE_SELECTED', {
        clientId: dto.clientId,
        tone,
        reason: this.getToneReason(dto.trigger),
      }, 'debug');

      // Generate message from template
      const message = this.generateMessageFromTemplate(tone, dto.metadata);

      AppLogger.logOperation('AI_MESSAGE_TEMPLATE_APPLIED', {
        clientId: dto.clientId,
        tone,
        messageLength: message.length,
      }, 'debug');

      // Save to database
      const aiMessage = new this.aiMessageModel({
        clientId: new Types.ObjectId(dto.clientId),
        message,
        tone,
        trigger: dto.trigger,
        isRead: false,
        metadata: dto.metadata,
      });

      await aiMessage.save();

      AppLogger.logOperation('AI_MESSAGE_CREATED', {
        messageId: aiMessage._id.toString(),
        clientId: dto.clientId,
        tone,
        trigger: dto.trigger,
        messagePreview: message.substring(0, 50),
      }, 'info');

      AppLogger.logComplete('AI_MESSAGE_GENERATE', {
        messageId: aiMessage._id.toString(),
        clientId: dto.clientId,
      });

      return aiMessage;
    } catch (error) {
      AppLogger.logError('AI_MESSAGE_GENERATE', {
        clientId: dto.clientId,
        trigger: dto.trigger,
      }, error);
      throw error;
    }
  }

  /**
   * Get all messages for a client
   */
  async getMessages(clientId: string): Promise<AIMessageDto[]> {
    AppLogger.logOperation('AI_MESSAGE_GET_HISTORY', {
      clientId,
    }, 'debug');

    const messages = await this.aiMessageModel
      .find({ clientId: new Types.ObjectId(clientId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    AppLogger.logOperation('AI_MESSAGE_GET_HISTORY', {
      clientId,
      count: messages.length,
    }, 'info');

    return messages.map(msg => ({
      id: (msg as any)._id.toString(),
      clientId: msg.clientId.toString(),
      message: msg.message,
      tone: msg.tone,
      trigger: msg.trigger,
      isRead: msg.isRead,
      metadata: msg.metadata,
      createdAt: (msg as any).createdAt,
      updatedAt: (msg as any).updatedAt,
    }));
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    AppLogger.logOperation('AI_MESSAGE_MARK_READ', {
      messageId,
    }, 'debug');

    const result = await this.aiMessageModel
      .findByIdAndUpdate(messageId, { isRead: true })
      .exec();

    if (!result) {
      throw new NotFoundException('Message not found');
    }

    AppLogger.logOperation('AI_MESSAGE_MARK_READ', {
      messageId,
      success: true,
    }, 'info');
  }

  /**
   * Select appropriate tone based on trigger and metadata
   */
  private selectTone(trigger: AIMessageTrigger, metadata?: Record<string, any>): AIMessageTone {
    switch (trigger) {
      case AIMessageTrigger.MISSED_WORKOUTS:
        const missedCount = metadata?.missedCount || 0;
        return missedCount > 2 ? AIMessageTone.AGGRESSIVE : AIMessageTone.WARNING;
      
      case AIMessageTrigger.SICK_DAY:
        return AIMessageTone.EMPATHETIC;
      
      case AIMessageTrigger.STREAK:
        return AIMessageTone.MOTIVATIONAL;
      
      case AIMessageTrigger.WEIGHT_SPIKE:
        const weightChange = metadata?.weightChange || 0;
        return weightChange > 3 ? AIMessageTone.WARNING : AIMessageTone.AGGRESSIVE;
      
      default:
        return AIMessageTone.MOTIVATIONAL;
    }
  }

  /**
   * Generate message from template with variable replacement
   */
  private generateMessageFromTemplate(tone: AIMessageTone, metadata?: Record<string, any>): string {
    const templates = this.MESSAGE_TEMPLATES[tone];
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Replace variables in template
    let message = template;
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        message = message.replace(`{${key}}`, metadata[key]);
      });
    }

    return message;
  }

  /**
   * Get reason for tone selection
   */
  private getToneReason(trigger: AIMessageTrigger): string {
    switch (trigger) {
      case AIMessageTrigger.MISSED_WORKOUTS:
        return 'Multiple missed workouts detected';
      case AIMessageTrigger.SICK_DAY:
        return 'Client marked as sick';
      case AIMessageTrigger.STREAK:
        return 'Positive streak detected';
      case AIMessageTrigger.WEIGHT_SPIKE:
        return 'Significant weight change detected';
      default:
        return 'Unknown trigger';
    }
  }
}

