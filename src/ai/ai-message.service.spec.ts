import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AIMessageService } from './ai-message.service';
import { AIMessage, AIMessageDocument, MessageType } from './schemas/ai-message.schema';
import { ClientsService } from '../clients/clients.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { NotFoundException } from '@nestjs/common';

describe('AIMessageService', () => {
  let service: AIMessageService;
  let messageModel: jest.Mocked<Model<AIMessageDocument>>;
  let clientsService: jest.Mocked<ClientsService>;
  let workoutsService: jest.Mocked<WorkoutsService>;
  let mockMessageConstructor: jest.Mock;

  const mockClientId = '507f1f77bcf86cd799439011';
  const mockClientProfileId = '507f1f77bcf86cd799439012';

  const mockClientProfile = {
    _id: new Types.ObjectId(mockClientProfileId),
    userId: new Types.ObjectId(mockClientId),
  };

  const mockMessage = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
    clientId: new Types.ObjectId(mockClientProfileId),
    messageType: MessageType.MOTIVATION,
    content: "You're doing great! Keep pushing forward.",
    generatedAt: new Date(),
    trainerApproved: false,
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(async () => {
    // Mock constructor for AIMessage model
    mockMessageConstructor = jest.fn().mockImplementation((data) => ({
      ...data,
      ...mockMessage,
      save: jest.fn().mockResolvedValue({ ...data, ...mockMessage }),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIMessageService,
        {
          provide: getModelToken(AIMessage.name),
          useValue: mockMessageConstructor, // Direktno koristiti, bez Object.assign
        },
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
        {
          provide: WorkoutsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AIMessageService>(AIMessageService);
    messageModel = module.get(getModelToken(AIMessage.name)) as any;
    clientsService = module.get(ClientsService);
    workoutsService = module.get(WorkoutsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectPerformanceDrop', () => {
    it('should return false (placeholder implementation)', async () => {
      // MERODAVNOST PROVERA: Test mora proveriti da metoda vraća false
      // NE mock-ovati logiku koja ne postoji
      const result = await service.detectPerformanceDrop(mockClientId);

      expect(result).toBe(false);
      
      // Verify that no actual analysis is performed (it's a placeholder)
      // The method should just return false without doing any work
    });
  });

  describe('generateMessage', () => {
    beforeEach(() => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
    });

    it('should generate MOTIVATION message and save to database', async () => {
      const result = await service.generateMessage(mockClientProfileId, MessageType.MOTIVATION);

      expect(clientsService.getProfile).toHaveBeenCalledWith(mockClientProfileId);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      // Verify message is one of the MOTIVATION templates
      const motivationTemplates = [
        "You're doing great! Keep pushing forward.",
        "Every workout counts. You've got this!",
      ];
      expect(motivationTemplates).toContain(result);

      // MERODAVNOST PROVERA: Proveriti da je constructor pozvan sa ispravnim podacima
      expect(mockMessageConstructor).toHaveBeenCalled();
      expect(mockMessageConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: expect.any(Object),
          messageType: MessageType.MOTIVATION,
          content: expect.any(String),
          generatedAt: expect.any(Date),
          trainerApproved: false,
        }),
      );

      // Proveriti da je save() pozvan
      const constructorCall = mockMessageConstructor.mock.calls[0];
      const messageInstance = mockMessageConstructor.mock.results[0].value;
      expect(messageInstance.save).toHaveBeenCalled();
    });

    it('should generate PASSIVE_AGGRESSIVE message and save to database', async () => {
      const result = await service.generateMessage(mockClientProfileId, MessageType.PASSIVE_AGGRESSIVE);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const passiveAggressiveTemplates = [
        "Another missed workout? Your trainer is not impressed. Get back on track.",
        "Your consistency is slipping. Time to step up your game.",
        "Missing workouts won't get you results. Show up or pay up.",
      ];
      expect(passiveAggressiveTemplates).toContain(result);
    });

    it('should generate EMPATHY message and save to database', async () => {
      const result = await service.generateMessage(mockClientProfileId, MessageType.EMPATHY);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const empathyTemplates = [
        "We understand you might be going through a tough time. Take care of yourself, but don't let this become a habit.",
        "If you're feeling unwell, rest is important. Let your trainer know when you're ready to get back on track.",
      ];
      expect(empathyTemplates).toContain(result);
    });

    it('should generate WARNING message and save to database', async () => {
      const result = await service.generateMessage(mockClientProfileId, MessageType.WARNING);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const warningTemplates = [
        "You're falling behind on your workouts. Time to refocus.",
        "Your trainer has noticed a drop in your activity. Let's turn this around.",
      ];
      expect(warningTemplates).toContain(result);
    });

    it('should generate PENALTY message and save to database', async () => {
      const result = await service.generateMessage(mockClientProfileId, MessageType.PENALTY);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const penaltyTemplates = [
        "You've missed too many workouts. Penalty mode activated.",
        "Your lack of consistency has consequences. Time to pay the price.",
      ];
      expect(penaltyTemplates).toContain(result);
    });

    it('should generate CELEBRATION message and save to database', async () => {
      const result = await service.generateMessage(mockClientProfileId, MessageType.CELEBRATION);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const celebrationTemplates = [
        "Amazing work this week! You're crushing your goals!",
        "Outstanding consistency! Your trainer is proud.",
      ];
      expect(celebrationTemplates).toContain(result);
    });

    it('should save message with correct properties to database', async () => {
      const messageType = MessageType.WARNING;
      
      // Clear previous calls
      mockMessageConstructor.mockClear();

      await service.generateMessage(mockClientProfileId, messageType);

      // MERODAVNOST PROVERA: Proveriti da su svi property-ji ispravno postavljeni
      expect(mockMessageConstructor).toHaveBeenCalled();
      const constructorCall = mockMessageConstructor.mock.calls[0];
      const messageData = constructorCall[0];

      expect(messageData.clientId).toEqual(mockClientProfile._id);
      expect(messageData.messageType).toBe(messageType);
      expect(messageData.content).toBeDefined();
      expect(typeof messageData.content).toBe('string');
      expect(messageData.generatedAt).toBeInstanceOf(Date);
      expect(messageData.trainerApproved).toBe(false);

      // Proveriti da je save() pozvan
      const messageInstance = mockMessageConstructor.mock.results[0].value;
      expect(messageInstance.save).toHaveBeenCalled();
    });

    it('should use MOTIVATION template as fallback for unknown MessageType', async () => {
      // Test with invalid MessageType (should not happen in practice, but test edge case)
      const invalidType = 'INVALID_TYPE' as MessageType;
      
      const result = await service.generateMessage(mockClientProfileId, invalidType);

      // Should fallback to MOTIVATION templates
      const motivationTemplates = [
        "You're doing great! Keep pushing forward.",
        "Every workout counts. You've got this!",
      ];
      expect(motivationTemplates).toContain(result);
    });

    it('should throw error if client profile not found', async () => {
      clientsService.getProfile.mockRejectedValue(new NotFoundException('Client profile not found'));

      await expect(service.generateMessage(mockClientProfileId, MessageType.MOTIVATION)).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendPushNotification', () => {
    it('should log push notification (placeholder implementation)', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const message = 'Test message';

      await service.sendPushNotification(mockClientId, message);

      // MERODAVNOST PROVERA: Test mora proveriti da se poziva console.log
      // NE mock-ovati Firebase logiku koja ne postoji
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[AIMessageService] Would send push notification to client ${mockClientId}: ${message}`),
      );

      consoleSpy.mockRestore();
    });

    it('should not throw error (placeholder does not fail)', async () => {
      const message = 'Test message';

      await expect(service.sendPushNotification(mockClientId, message)).resolves.not.toThrow();
    });
  });
});
