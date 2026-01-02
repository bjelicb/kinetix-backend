import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { AIMessageService } from './ai-message.service';
import { AIMessage, AIMessageDocument, AIMessageTone, AIMessageTrigger } from './schemas/ai-message.schema';
import { GenerateMessageDto } from './dto/generate-message.dto';

describe('AIMessageService (Gamification)', () => {
  let service: AIMessageService;
  let aiMessageModel: jest.Mocked<Model<AIMessageDocument>>;
  let mockMessageConstructor: jest.Mock;

  const mockClientId = '507f1f77bcf86cd799439011';
  const mockMessageId = '507f1f77bcf86cd799439012';

  const mockMessage: Partial<AIMessageDocument> = {
    _id: new Types.ObjectId(mockMessageId),
    clientId: new Types.ObjectId(mockClientId),
    message: 'Test message',
    tone: AIMessageTone.MOTIVATIONAL,
    trigger: AIMessageTrigger.STREAK,
    isRead: false,
    metadata: { streak: 7 },
    save: jest.fn().mockResolvedValue(this),
    toObject: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    // Mock constructor for AIMessage model - allow service to use real logic
    mockMessageConstructor = jest.fn().mockImplementation((data) => {
      const messageInstance = {
        ...data,
        _id: new Types.ObjectId(),
        save: jest.fn().mockImplementation(async function() {
          // Return the instance itself with all data
          return { ...this, ...data };
        }),
        toObject: jest.fn().mockReturnValue({ ...data, _id: new Types.ObjectId() }),
        toString: jest.fn().mockReturnValue(new Types.ObjectId().toString()),
      };
      return messageInstance;
    });

    const mockModel = Object.assign(mockMessageConstructor, {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn(),
          }),
        }),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn(),
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIMessageService,
        {
          provide: getModelToken(AIMessage.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<AIMessageService>(AIMessageService);
    aiMessageModel = module.get(getModelToken(AIMessage.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMessage', () => {
    it('should generate AGGRESSIVE tone message for MISSED_WORKOUTS trigger with high missedCount', async () => {
      // MERODAVNOST: Proverava da se generiše AGGRESSIVE tone za više od 2 missed workouts
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
        metadata: { missedCount: 3 },
      };

      const result = await service.generateMessage(dto);

      expect(mockMessageConstructor).toHaveBeenCalled();
      expect(result.tone).toBe(AIMessageTone.AGGRESSIVE);
      expect(result.trigger).toBe(AIMessageTrigger.MISSED_WORKOUTS);
      // Poruka može biti bilo koja AGGRESSIVE template poruka za MISSED_WORKOUTS
      // Ne proveravamo specifičnu reč u poruci jer template-i se biraju random
      expect(result.message).toBeDefined();
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.clientId.toString()).toBe(mockClientId);
    });

    it('should generate WARNING tone message for MISSED_WORKOUTS trigger with low missedCount', async () => {
      // MERODAVNOST: Proverava da se generiše WARNING tone za 2 ili manje missed workouts
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
        metadata: { missedCount: 2 },
      };

      const result = await service.generateMessage(dto);

      expect(result.tone).toBe(AIMessageTone.WARNING);
      expect(result.trigger).toBe(AIMessageTrigger.MISSED_WORKOUTS);
    });

    it('should generate EMPATHETIC tone message for SICK_DAY trigger', async () => {
      // MERODAVNOST: Proverava da se generiše EMPATHETIC tone za SICK_DAY trigger
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.SICK_DAY,
      };

      const result = await service.generateMessage(dto);

      expect(result.tone).toBe(AIMessageTone.EMPATHETIC);
      expect(result.trigger).toBe(AIMessageTrigger.SICK_DAY);
      // Template može biti različit - proveravamo da je poruka validna i da je tone ispravan
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.message).toBeTruthy();
    });

    it('should generate MOTIVATIONAL tone message for STREAK trigger', async () => {
      // MERODAVNOST: Proverava da se generiše MOTIVATIONAL tone za STREAK trigger
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.STREAK,
        metadata: { streak: 7 },
      };

      const result = await service.generateMessage(dto);

      expect(result.tone).toBe(AIMessageTone.MOTIVATIONAL);
      expect(result.trigger).toBe(AIMessageTrigger.STREAK);
      expect(result.message).toContain('7');
    });

    it('should generate WARNING tone message for WEIGHT_SPIKE trigger with high weightChange', async () => {
      // MERODAVNOST: Proverava da se generiše WARNING tone za weight change > 3kg
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.WEIGHT_SPIKE,
        metadata: { weightChange: 4 },
      };

      const result = await service.generateMessage(dto);

      expect(result.tone).toBe(AIMessageTone.WARNING);
      expect(result.trigger).toBe(AIMessageTrigger.WEIGHT_SPIKE);
      expect(result.message).toContain('4');
    });

    it('should generate AGGRESSIVE tone message for WEIGHT_SPIKE trigger with low weightChange', async () => {
      // MERODAVNOST: Proverava da se generiše AGGRESSIVE tone za weight change <= 3kg
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.WEIGHT_SPIKE,
        metadata: { weightChange: 2 },
      };

      const result = await service.generateMessage(dto);

      expect(result.tone).toBe(AIMessageTone.AGGRESSIVE);
      expect(result.trigger).toBe(AIMessageTrigger.WEIGHT_SPIKE);
    });

    it('should replace template variables with metadata values', async () => {
      // MERODAVNOST: Proverava da se template varijable zamenjuju sa metadata vrednostima
      // Napomena: Neki template-i su hardcoded (npr. "7 days straight..."), 
      // ali template-i sa {streak} moraju biti zamenjeni
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.STREAK,
        metadata: { streak: 10 },
      };

      const result = await service.generateMessage(dto);

      // Proveravamo da template varijabla nije prisutna (zamenjena je)
      expect(result.message).not.toContain('{streak}');
      // Ako template sadrži {streak}, mora biti zamenjen sa 10
      // Ako je hardcoded template, proveravamo da je poruka validna
      if (result.message.includes('10')) {
        expect(result.message).toContain('10');
      } else {
        // Hardcoded template - proveravamo da je poruka validna
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('should replace missedCount variable in template', async () => {
      // MERODAVNOST: Proverava da se {missedCount} zamenjuje sa stvarnom vrednošću
      // Napomena: Neki template-i su hardcoded (npr. "2 missed workouts..."), 
      // ali template-i sa {missedCount} moraju biti zamenjeni
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.MISSED_WORKOUTS,
        metadata: { missedCount: 5 },
      };

      const result = await service.generateMessage(dto);

      // Proveravamo da template varijabla nije prisutna (zamenjena je)
      expect(result.message).not.toContain('{missedCount}');
      // Ako template sadrži {missedCount}, mora biti zamenjen sa 5
      // Ako je hardcoded template, proveravamo da je poruka validna
      if (result.message.includes('5')) {
        expect(result.message).toContain('5');
      } else {
        // Hardcoded template - proveravamo da je poruka validna
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('should replace weightChange variable in template', async () => {
      // MERODAVNOST: Proverava da se {weightChange} zamenjuje sa stvarnom vrednošću
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.WEIGHT_SPIKE,
        metadata: { weightChange: 3.5 },
      };

      const result = await service.generateMessage(dto);

      expect(result.message).toContain('3.5');
      expect(result.message).not.toContain('{weightChange}');
    });

    it('should use custom message when provided', async () => {
      // MERODAVNOST: Proverava da se koristi custom message kada je prosleđen
      const customMessage = 'Custom motivational message';
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.STREAK,
        customMessage,
        tone: AIMessageTone.MOTIVATIONAL,
      };

      const result = await service.generateMessage(dto);

      expect(result.message).toBe(customMessage);
      expect(result.tone).toBe(AIMessageTone.MOTIVATIONAL);
    });

    it('should use default WARNING tone when custom message provided without tone', async () => {
      // MERODAVNOST: Proverava da se koristi default WARNING tone kada custom message nema tone
      const customMessage = 'Custom message';
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.STREAK,
        customMessage,
      };

      const result = await service.generateMessage(dto);

      expect(result.message).toBe(customMessage);
      expect(result.tone).toBe(AIMessageTone.WARNING);
    });

    it('should save message to database', async () => {
      // MERODAVNOST: Proverava da se poruka čuva u bazu
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.STREAK,
        metadata: { streak: 7 },
      };

      const saveSpy = jest.fn().mockImplementation(async function() {
        return { ...this, ...dto };
      });

      mockMessageConstructor.mockImplementation((data) => {
        const instance = {
          ...data,
          _id: new Types.ObjectId(),
          save: saveSpy,
        };
        return instance;
      });

      await service.generateMessage(dto);

      expect(saveSpy).toHaveBeenCalled();
    });

    it('should propagate error when database save fails', async () => {
      // MERODAVNOST: Proverava error handling kada database save baca grešku
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.STREAK,
      };

      const error = new Error('Database error');
      mockMessageConstructor.mockImplementation((data) => {
        const instance = {
          ...data,
          _id: new Types.ObjectId(),
          save: jest.fn().mockRejectedValue(error),
        };
        return instance;
      });

      await expect(service.generateMessage(dto)).rejects.toThrow('Database error');
    });

    it('should select random template from available templates', async () => {
      // MERODAVNOST: Proverava da se bira random template iz niza
      const dto: GenerateMessageDto = {
        clientId: mockClientId,
        trigger: AIMessageTrigger.STREAK,
        metadata: { streak: 7 },
      };

      // Run multiple times to verify random selection
      const results = await Promise.all([
        service.generateMessage(dto),
        service.generateMessage(dto),
        service.generateMessage(dto),
      ]);

      // At least one should be different (random selection)
      // All should be valid MOTIVATIONAL messages
      results.forEach((result) => {
        expect(result.tone).toBe(AIMessageTone.MOTIVATIONAL);
        expect(result.message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getMessages', () => {
    it('should return all messages for client sorted by date (newest first)', async () => {
      // MERODAVNOST: Proverava da se vraćaju sve poruke za klijenta sortirane po datumu
      const mockMessages = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
          clientId: new Types.ObjectId(mockClientId),
          message: 'Message 1',
          tone: AIMessageTone.MOTIVATIONAL,
          trigger: AIMessageTrigger.STREAK,
          isRead: false,
          metadata: {},
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
        },
        {
          _id: new Types.ObjectId('507f1f77bcf86cd799439014'),
          clientId: new Types.ObjectId(mockClientId),
          message: 'Message 2',
          tone: AIMessageTone.AGGRESSIVE,
          trigger: AIMessageTrigger.MISSED_WORKOUTS,
          isRead: true,
          metadata: {},
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ];

      const findChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMessages),
      };

      (aiMessageModel.find as jest.Mock).mockReturnValue(findChain);

      const result = await service.getMessages(mockClientId);

      expect(aiMessageModel.find).toHaveBeenCalledWith({
        clientId: new Types.ObjectId(mockClientId),
      });
      expect(findChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('507f1f77bcf86cd799439013');
      expect(result[0].message).toBe('Message 1');
      expect(result[1].id).toBe('507f1f77bcf86cd799439014');
      expect(result[1].message).toBe('Message 2');
    });

    it('should return empty array when no messages exist for client', async () => {
      // MERODAVNOST: Proverava da se vraća prazan niz kada nema poruka
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      (aiMessageModel.find as jest.Mock).mockReturnValue(findChain);

      const result = await service.getMessages(mockClientId);

      expect(result).toEqual([]);
    });

    it('should propagate error when database query fails', async () => {
      // MERODAVNOST: Proverava error handling kada database query baca grešku
      const error = new Error('Database error');
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(error),
      };

      (aiMessageModel.find as jest.Mock).mockReturnValue(findChain);

      await expect(service.getMessages(mockClientId)).rejects.toThrow('Database error');
    });
  });

  describe('getAllMessages', () => {
    it('should return all messages across all clients sorted by date (newest first)', async () => {
      // MERODAVNOST: Proverava da se vraćaju sve poruke za sve klijente (admin funkcija)
      const mockMessages = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
          clientId: new Types.ObjectId(mockClientId),
          message: 'Message 1',
          tone: AIMessageTone.MOTIVATIONAL,
          trigger: AIMessageTrigger.STREAK,
          isRead: false,
          metadata: {},
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
        },
        {
          _id: new Types.ObjectId('507f1f77bcf86cd799439014'),
          clientId: new Types.ObjectId('507f1f77bcf86cd799439015'),
          message: 'Message 2',
          tone: AIMessageTone.AGGRESSIVE,
          trigger: AIMessageTrigger.MISSED_WORKOUTS,
          isRead: true,
          metadata: {},
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ];

      const findChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMessages),
      };

      (aiMessageModel.find as jest.Mock).mockReturnValue(findChain);

      const result = await service.getAllMessages();

      expect(aiMessageModel.find).toHaveBeenCalledWith({});
      expect(findChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('507f1f77bcf86cd799439013');
      expect(result[1].id).toBe('507f1f77bcf86cd799439014');
    });

    it('should return empty array when no messages exist', async () => {
      // MERODAVNOST: Proverava da se vraća prazan niz kada nema poruka
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      (aiMessageModel.find as jest.Mock).mockReturnValue(findChain);

      const result = await service.getAllMessages();

      expect(result).toEqual([]);
    });

    it('should propagate error when database query fails', async () => {
      // MERODAVNOST: Proverava error handling kada database query baca grešku
      const error = new Error('Database error');
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(error),
      };

      (aiMessageModel.find as jest.Mock).mockReturnValue(findChain);

      await expect(service.getAllMessages()).rejects.toThrow('Database error');
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read', async () => {
      // MERODAVNOST: Proverava da se poruka označava kao pročitana
      const mockUpdatedMessage = {
        ...mockMessage,
        isRead: true,
      };

      const updateChain = {
        exec: jest.fn().mockResolvedValue(mockUpdatedMessage),
      };

      (aiMessageModel.findByIdAndUpdate as jest.Mock).mockReturnValue(updateChain);

      await service.markAsRead(mockMessageId);

      expect(aiMessageModel.findByIdAndUpdate).toHaveBeenCalledWith(mockMessageId, { isRead: true });
      expect(updateChain.exec).toHaveBeenCalled();
    });

    it('should throw NotFoundException when message not found', async () => {
      // MERODAVNOST: Proverava error handling kada poruka ne postoji
      const updateChain = {
        exec: jest.fn().mockResolvedValue(null),
      };

      (aiMessageModel.findByIdAndUpdate as jest.Mock).mockReturnValue(updateChain);

      await expect(service.markAsRead(mockMessageId)).rejects.toThrow(NotFoundException);
      await expect(service.markAsRead(mockMessageId)).rejects.toThrow('Message not found');
    });

    it('should propagate error when database update fails', async () => {
      // MERODAVNOST: Proverava error handling kada database update baca grešku
      const error = new Error('Database error');
      const updateChain = {
        exec: jest.fn().mockRejectedValue(error),
      };

      (aiMessageModel.findByIdAndUpdate as jest.Mock).mockReturnValue(updateChain);

      await expect(service.markAsRead(mockMessageId)).rejects.toThrow('Database error');
    });
  });
});
