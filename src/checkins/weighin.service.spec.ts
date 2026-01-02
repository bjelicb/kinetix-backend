import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WeighInService } from './weighin.service';
import { WeighIn, WeighInDocument } from './schemas/weighin.schema';
import { ClientsService } from '../clients/clients.service';
import { ClientProfileDocument } from '../clients/schemas/client-profile.schema';

describe('WeighInService', () => {
  let service: WeighInService;
  let weighInModel: any;
  let clientsService: jest.Mocked<ClientsService>;
  let mockClientProfileId: Types.ObjectId;
  let mockClientProfile: Partial<ClientProfileDocument>;

  beforeEach(async () => {
    mockClientProfileId = new Types.ObjectId();

    // ✅ ISPRAVNO: Constructor mock pattern (kao u WorkoutsService testovima)
    const mockSave = jest.fn();
    const mockModelConstructor = jest.fn().mockImplementation((data) => {
      const savedData = { ...data, _id: new Types.ObjectId() };
      mockSave.mockResolvedValue(savedData);
      return {
        ...data,
        save: mockSave,
      };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeighInService,
        {
          provide: getModelToken(WeighIn.name),
          useValue: mockModelConstructor, // ✅ Constructor mock
        },
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WeighInService>(WeighInService);
    weighInModel = module.get(getModelToken(WeighIn.name));
    clientsService = module.get(ClientsService);

    // ✅ Dodati chain metode za findOne().sort().exec() (za lastWeighIn query)
    (weighInModel as any).findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });

    // ✅ Dodati chain metode za find().sort().exec() (za getWeighInHistory)
    (weighInModel as any).find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });

    // Store mockSave for verification
    (weighInModel as any).mockSave = mockSave;

    // Default mock client profile
    mockClientProfile = {
      _id: mockClientProfileId,
      planHistory: [],
      currentPlanId: undefined,
      planStartDate: undefined,
    };

    clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createWeighIn', () => {
    it('should create weigh-in with basic data', async () => {
      // MERODAVNOST: Proveriti da se weigh-in čuva sa ispravnim podacima
      const weight = 75.5;
      const date = new Date('2024-01-16'); // Tuesday (not Monday) to avoid isMandatory=true
      const photoUrl = 'https://example.com/photo.jpg';
      const notes = 'Test notes';

      // Mock findOne for duplicate check (returns null = no duplicate)
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn (returns null - no previous weigh-in)
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createWeighIn(
        mockClientProfileId.toString(),
        weight,
        date,
        photoUrl,
        notes,
      );

      expect(clientsService.getProfile).toHaveBeenCalledWith(mockClientProfileId.toString());
      expect(result).toBeDefined();
      expect(result.weight).toBe(weight);
      expect(result.photoUrl).toBe(photoUrl);
      expect(result.notes).toBe(notes);
      expect(result.isMandatory).toBe(false);
      expect(result.isWeightSpike).toBe(false);
      expect(result.aiFlagged).toBe(false);
      // Verify save was called (through mockSave)
      expect((weighInModel as any).mockSave).toHaveBeenCalled();
    });

    it('should throw BadRequestException if weigh-in already exists for date', async () => {
      // MERODAVNOST: Proveriti duplicate check logiku
      const weight = 75.5;
      const date = new Date('2024-01-15');
      date.setHours(0, 0, 0, 0);
      const existingWeighIn = {
        _id: new Types.ObjectId(),
        clientId: mockClientProfileId,
        date,
        weight: 74.0,
      };

      // Mock findOne for duplicate check (returns existing weigh-in)
      // First call is duplicate check - findOne({ clientId, date }).exec() (no sort)
      // Reset findOne mock and set up for this test
      (weighInModel as any).findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingWeighIn),
      });

      await expect(
        service.createWeighIn(mockClientProfileId.toString(), weight, date),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createWeighIn(mockClientProfileId.toString(), weight, date),
      ).rejects.toThrow('Weigh-in already recorded for this date.');
    });

    it('should link weigh-in to active plan from planHistory', async () => {
      // MERODAVNOST: Proveriti plan linking logiku (planHistory prioritet)
      const planId = new Types.ObjectId();
      // Use dates that are definitely in the past (plan started) and future (plan ends)
      const now = new Date();
      const planStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const planEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      mockClientProfile.planHistory = [
        {
          planId,
          planStartDate,
          planEndDate,
          assignedAt: new Date(),
          trainerId: new Types.ObjectId(),
        },
      ];

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      const date = new Date(); // Today (within plan range)

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn (returns null - no previous weigh-in)
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight, date);

      expect(result.planId).toEqual(planId);
      expect(result.planStartDate).toEqual(planStartDate);
      expect((weighInModel as any).mockSave).toHaveBeenCalled();
    });

    it('should link weigh-in to active plan from currentPlanId (fallback)', async () => {
      // MERODAVNOST: Proveriti fallback logiku (currentPlanId ako nema planHistory)
      const planId = new Types.ObjectId();
      const planStartDate = new Date('2024-01-08'); // Monday

      mockClientProfile.planHistory = []; // No planHistory
      mockClientProfile.currentPlanId = planId;
      mockClientProfile.planStartDate = planStartDate;

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      const date = new Date('2024-01-10');

      

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn (returns null - no previous weigh-in)
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight, date);

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.planId).toEqual(planId);
      expect(result.planStartDate).toEqual(planStartDate);
    });

    it('should not link weigh-in if no active plan', async () => {
      // MERODAVNOST: Proveriti da se weigh-in kreira bez planId ako nema active plan
      mockClientProfile.planHistory = [];
      mockClientProfile.currentPlanId = undefined;
      mockClientProfile.planStartDate = undefined;

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      const date = new Date('2024-01-10');

      

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn (returns null - no previous weigh-in)
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight, date);

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.planId).toBeUndefined();
      expect(result.planStartDate).toBeUndefined();
    });

    it('should set isMandatory=true if weigh-in is on Monday (no plan)', async () => {
      // MERODAVNOST: Proveriti mandatory flag logiku za Monday (bez plana)
      mockClientProfile.planHistory = [];
      mockClientProfile.currentPlanId = undefined;

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      const monday = new Date('2024-01-08'); // Monday
      monday.setHours(0, 0, 0, 0);

      

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn (returns null - no previous weigh-in)
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight, monday);

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.isMandatory).toBe(true);
    });

    it('should set isMandatory=true if weigh-in is on plan week Monday', async () => {
      // MERODAVNOST: Proveriti mandatory flag logiku za plan week Monday
      const planId = new Types.ObjectId();
      const planStartDate = new Date('2024-01-08'); // Monday
      const planEndDate = new Date('2025-12-31'); // Future date (plan is active)

      mockClientProfile.planHistory = [
        {
          planId,
          planStartDate,
          planEndDate,
          assignedAt: new Date(),
          trainerId: new Types.ObjectId(),
        },
      ];

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      const monday = new Date('2024-01-08'); // Same Monday as plan start
      monday.setHours(0, 0, 0, 0);

      

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn (returns null - no previous weigh-in)
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight, monday);

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.isMandatory).toBe(true);
    });

    it('should set isMandatory=false if weigh-in is not on Monday', async () => {
      // MERODAVNOST: Proveriti da mandatory flag je false za non-Monday
      const weight = 75.5;
      const tuesday = new Date('2024-01-09'); // Tuesday
      tuesday.setHours(0, 0, 0, 0);

      

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight, tuesday);

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.isMandatory).toBe(false);
    });

    it('should set isMandatory=false if weigh-in is Monday but not plan week Monday', async () => {
      // MERODAVNOST: Proveriti da mandatory flag je false ako je Monday ali nije plan week Monday
      const planId = new Types.ObjectId();
      // Use dates relative to now to ensure plan is active
      const now = new Date();
      // Plan started 14 days ago (Monday)
      const planStartDate = new Date(now);
      planStartDate.setDate(planStartDate.getDate() - 14);
      // Set to Monday of that week
      const dayOfWeek = planStartDate.getDay();
      const diff = planStartDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      planStartDate.setDate(diff);
      planStartDate.setHours(0, 0, 0, 0);
      
      const planEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      mockClientProfile.planHistory = [
        {
          planId,
          planStartDate,
          planEndDate,
          assignedAt: new Date(),
          trainerId: new Types.ObjectId(),
        },
      ];

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      // Use next Monday (7 days from plan start Monday) - different week
      const nextMonday = new Date(planStartDate);
      nextMonday.setDate(nextMonday.getDate() + 7); // Next Monday (different week)
      nextMonday.setHours(0, 0, 0, 0);

      

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn (returns null - no previous weigh-in)
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.createWeighIn(
        mockClientProfileId.toString(),
        weight,
        nextMonday,
      );

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.isMandatory).toBe(false);
    });

    it('should detect weight spike (>5% increase) and set flags', async () => {
      // MERODAVNOST: Proveriti weight spike detection logiku
      const weight = 75.5;
      const date = new Date('2024-01-15');
      const lastWeight = 100; // Previous weight
      const currentWeight = 106; // 6% increase (>5%)

      const lastWeighIn = {
        _id: new Types.ObjectId(),
        clientId: mockClientProfileId,
        weight: lastWeight,
        date: new Date('2024-01-08'),
      };

      // Mock findOne for duplicate check (returns null)
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn (returns last weigh-in)
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(lastWeighIn),
      });

      

      const result = await service.createWeighIn(
        mockClientProfileId.toString(),
        currentWeight,
        date,
      );

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.isWeightSpike).toBe(true);
      expect(result.aiFlagged).toBe(true);
      expect(result.aiMessage).toContain('6.0%');
      expect(result.aiMessage).toContain('increased');
    });

    it('should detect significant weight loss (<-5% decrease) and set aiFlagged', async () => {
      // MERODAVNOST: Proveriti weight loss detection logiku
      const lastWeight = 100;
      const currentWeight = 94; // 6% decrease (<-5%)

      const lastWeighIn = {
        _id: new Types.ObjectId(),
        clientId: mockClientProfileId,
        weight: lastWeight,
        date: new Date('2024-01-08'),
      };

      // Mock findOne for duplicate check (returns null)
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(lastWeighIn),
      });

      

      const date = new Date('2024-01-15');
      const result = await service.createWeighIn(
        mockClientProfileId.toString(),
        currentWeight,
        date,
      );

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.isWeightSpike).toBe(false);
      expect(result.aiFlagged).toBe(true);
      expect(result.aiMessage).toContain('6.0%');
      expect(result.aiMessage).toContain('decreased');
    });

    it('should not set flags if weight change is within -5% to +5%', async () => {
      // MERODAVNOST: Proveriti da se flags ne postavljaju za normalne promene
      const lastWeight = 100;
      const currentWeight = 103; // 3% increase (within -5% to +5%)

      const lastWeighIn = {
        _id: new Types.ObjectId(),
        clientId: mockClientProfileId,
        weight: lastWeight,
        date: new Date('2024-01-08'),
      };

      // Mock findOne for duplicate check (returns null)
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(lastWeighIn),
      });

      

      const date = new Date('2024-01-15');
      const result = await service.createWeighIn(
        mockClientProfileId.toString(),
        currentWeight,
        date,
      );

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.isWeightSpike).toBe(false);
      expect(result.aiFlagged).toBe(false);
      expect(result.aiMessage).toBeUndefined();
    });

    it('should handle first weigh-in (no lastWeighIn)', async () => {
      // MERODAVNOST: Proveriti edge case: prvi weigh-in (nema prethodnog)
      const weight = 75.5;
      const date = new Date('2024-01-15');

      // Mock findOne for duplicate check (returns null)
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn (returns null - no previous weigh-in)
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight, date);

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.isWeightSpike).toBe(false);
      expect(result.aiFlagged).toBe(false);
      expect(result.aiMessage).toBeUndefined();
    });

    it('should normalize date to start of day (00:00:00)', async () => {
      // MERODAVNOST: Proveriti date normalization logiku
      const weight = 75.5;
      const dateWithTime = new Date('2024-01-15T14:30:00Z'); // Date with time

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      

      const result = await service.createWeighIn(
        mockClientProfileId.toString(),
        weight,
        dateWithTime,
      );

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      const normalizedDate = new Date(result.date);
      expect(normalizedDate.getHours()).toBe(0);
      expect(normalizedDate.getMinutes()).toBe(0);
      expect(normalizedDate.getSeconds()).toBe(0);
      expect(normalizedDate.getMilliseconds()).toBe(0);
    });

    it('should use current date if date not provided', async () => {
      // MERODAVNOST: Proveriti default date logiku
      const weight = 75.5;
      const beforeCall = new Date();
      beforeCall.setHours(0, 0, 0, 0);

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight);

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      const savedDate = new Date(result.date);
      const afterCall = new Date();
      afterCall.setHours(0, 0, 0, 0);

      // Date should be today (normalized to start of day)
      expect(savedDate.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(savedDate.getTime()).toBeLessThanOrEqual(afterCall.getTime());
      expect(savedDate.getHours()).toBe(0);
    });

    it('should handle planId parameter (override active plan)', async () => {
      // MERODAVNOST: Proveriti da planId parameter override-uje active plan
      const activePlanId = new Types.ObjectId();
      const overridePlanId = new Types.ObjectId();
      const planStartDate = new Date('2024-01-08');

      mockClientProfile.planHistory = [
        {
          planId: activePlanId,
          planStartDate,
          planEndDate: new Date('2024-01-15'),
          assignedAt: new Date(),
          trainerId: new Types.ObjectId(),
        },
      ];

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      const date = new Date('2024-01-10');

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      

      const result = await service.createWeighIn(
        mockClientProfileId.toString(),
        weight,
        date,
        undefined,
        undefined,
        overridePlanId.toString(),
      );

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.planId).toBeDefined();
      expect(result.planId!.toString()).toBe(overridePlanId.toString());
    });

    it('should handle planId parameter that does not match active plan (linkedPlanStartDate undefined)', async () => {
      // MERODAVNOST: Edge case - planId parameter ne odgovara active plan-u
      const activePlanId = new Types.ObjectId();
      const overridePlanId = new Types.ObjectId();
      const planStartDate = new Date('2024-01-08');

      mockClientProfile.planHistory = [
        {
          planId: activePlanId,
          planStartDate,
          planEndDate: new Date('2024-01-15'),
          assignedAt: new Date(),
          trainerId: new Types.ObjectId(),
        },
      ];

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      const date = new Date('2024-01-10');

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      

      const result = await service.createWeighIn(
        mockClientProfileId.toString(),
        weight,
        date,
        undefined,
        undefined,
        overridePlanId.toString(),
      );

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      expect(result.planId).toBeDefined();
      expect(result.planId!.toString()).toBe(overridePlanId.toString());
      // linkedPlanStartDate should be undefined because overridePlanId doesn't match activePlanId
      expect(result.planStartDate).toBeUndefined();
    });

    it('should handle planHistory with inactive plan (planEndDate < now)', async () => {
      // MERODAVNOST: Edge case - planHistory postoji ali plan nije aktivan
      const planId = new Types.ObjectId();
      const planStartDate = new Date('2024-01-01');
      const planEndDate = new Date('2024-01-07'); // Past date (plan ended)

      mockClientProfile.planHistory = [
        {
          planId,
          planStartDate,
          planEndDate,
          assignedAt: new Date(),
          trainerId: new Types.ObjectId(),
        },
      ];
      mockClientProfile.currentPlanId = undefined;

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      const date = new Date('2024-01-15'); // After plan end

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight, date);

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      // Plan should not be linked because planEndDate < now
      expect(result.planId).toBeUndefined();
      expect(result.planStartDate).toBeUndefined();
    });

    it('should handle planHistory with future plan (planStartDate > now)', async () => {
      // MERODAVNOST: Edge case - planHistory postoji ali plan još nije počeo
      const planId = new Types.ObjectId();
      const planStartDate = new Date('2025-01-08'); // Future date
      const planEndDate = new Date('2025-01-15');

      mockClientProfile.planHistory = [
        {
          planId,
          planStartDate,
          planEndDate,
          assignedAt: new Date(),
          trainerId: new Types.ObjectId(),
        },
      ];
      mockClientProfile.currentPlanId = undefined;

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const weight = 75.5;
      const date = new Date('2024-01-15'); // Before plan start

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      

      const result = await service.createWeighIn(mockClientProfileId.toString(), weight, date);

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      // Plan should not be linked because planStartDate > now
      expect(result.planId).toBeUndefined();
      expect(result.planStartDate).toBeUndefined();
    });

    it('should handle calculateWeightChange with previousWeight = 0', async () => {
      // MERODAVNOST: Edge case - calculateWeightChange() sa previousWeight = 0
      const lastWeight = 0; // Edge case: previousWeight = 0
      const currentWeight = 100;

      const lastWeighIn = {
        _id: new Types.ObjectId(),
        clientId: mockClientProfileId,
        weight: lastWeight,
        date: new Date('2024-01-08'),
      };

      // Mock findOne for duplicate check
      (weighInModel as any).findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findOne for lastWeighIn
      (weighInModel as any).findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(lastWeighIn),
      });

      

      const date = new Date('2024-01-15');
      const result = await service.createWeighIn(
        mockClientProfileId.toString(),
        currentWeight,
        date,
      );

      expect((weighInModel as any).mockSave).toHaveBeenCalled();
      // calculateWeightChange should return 0 when previousWeight = 0, so no flags should be set
      expect(result.isWeightSpike).toBe(false);
      expect(result.aiFlagged).toBe(false);
      expect(result.aiMessage).toBeUndefined();
    });
  });

  describe('getWeighInHistory', () => {
    it('should return weigh-in history sorted by date descending', async () => {
      // MERODAVNOST: Proveriti query logiku
      const mockWeighIns = [
        {
          _id: new Types.ObjectId(),
          clientId: mockClientProfileId,
          weight: 75.5,
          date: new Date('2024-01-15'),
        },
        {
          _id: new Types.ObjectId(),
          clientId: mockClientProfileId,
          weight: 74.0,
          date: new Date('2024-01-08'),
        },
      ];

      const mockSort = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(mockWeighIns);

      (weighInModel as any).find = jest.fn().mockReturnValue({
        sort: mockSort,
        exec: mockExec,
      });

      const result = await service.getWeighInHistory(mockClientProfileId.toString());

      expect(clientsService.getProfile).toHaveBeenCalledWith(mockClientProfileId.toString());
      expect((weighInModel as any).find).toHaveBeenCalledWith({
        clientId: mockClientProfileId,
      });
      expect(mockSort).toHaveBeenCalledWith({ date: -1 });
      expect(mockExec).toHaveBeenCalled();
      expect(result).toEqual(mockWeighIns);
    });

    it('should handle client not found', async () => {
      // MERODAVNOST: Proveriti error handling
      clientsService.getProfile.mockRejectedValue(new NotFoundException('Client not found'));

      await expect(
        service.getWeighInHistory(mockClientProfileId.toString()),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getWeighInHistory(mockClientProfileId.toString()),
      ).rejects.toThrow('Client not found');
    });
  });

  describe('getLatestWeighIn', () => {
    it('should return latest weigh-in', async () => {
      // MERODAVNOST: Proveriti query logiku
      const mockWeighIn = {
        _id: new Types.ObjectId(),
        clientId: mockClientProfileId,
        weight: 75.5,
        date: new Date('2024-01-15'),
      };

      const mockSort = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(mockWeighIn);

      (weighInModel as any).findOne = jest.fn().mockReturnValue({
        sort: mockSort,
        exec: mockExec,
      });

      const result = await service.getLatestWeighIn(mockClientProfileId.toString());

      expect(clientsService.getProfile).toHaveBeenCalledWith(mockClientProfileId.toString());
      expect((weighInModel as any).findOne).toHaveBeenCalledWith({
        clientId: mockClientProfileId,
      });
      expect(mockSort).toHaveBeenCalledWith({ date: -1 });
      expect(mockExec).toHaveBeenCalled();
      expect(result).toEqual(mockWeighIn);
    });

    it('should return null if no weigh-ins exist', async () => {
      // MERODAVNOST: Proveriti edge case: nema weigh-in-ova
      const mockSort = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(null);

      (weighInModel as any).findOne = jest.fn().mockReturnValue({
        sort: mockSort,
        exec: mockExec,
      });

      const result = await service.getLatestWeighIn(mockClientProfileId.toString());

      expect((weighInModel as any).findOne).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle client not found', async () => {
      // MERODAVNOST: Proveriti error handling
      clientsService.getProfile.mockRejectedValue(new NotFoundException('Client not found'));

      await expect(service.getLatestWeighIn(mockClientProfileId.toString())).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getLatestWeighIn(mockClientProfileId.toString())).rejects.toThrow(
        'Client not found',
      );
    });
  });
});
