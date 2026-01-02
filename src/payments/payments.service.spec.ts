import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { PaymentsService } from './payments.service';
import { ClientPayment, ClientPaymentDocument } from './schemas/client-payment.schema';
import { MonthlyInvoice, MonthlyInvoiceDocument, InvoiceStatus } from './schemas/monthly-invoice.schema';
import { ClientsService } from '../clients/clients.service';
import { GamificationService } from '../gamification/gamification.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentModel: jest.Mocked<Model<ClientPaymentDocument>>;
  let invoiceModel: jest.Mocked<Model<MonthlyInvoiceDocument>>;
  let clientsService: jest.Mocked<ClientsService>;
  let gamificationService: jest.Mocked<GamificationService>;
  let mockInvoiceConstructor: jest.Mock;

  const mockClientId = '507f1f77bcf86cd799439011';
  const mockClientProfileId = '507f1f77bcf86cd799439012';
  const mockInvoiceId = '507f1f77bcf86cd799439013';

  const mockClientProfile = {
    _id: new Types.ObjectId(mockClientProfileId),
    userId: new Types.ObjectId(mockClientId),
    penaltyHistory: [
      {
        date: new Date('2025-01-15T10:00:00.000Z'),
        amount: 1,
        reason: 'Missed workout',
        planId: new Types.ObjectId('507f1f77bcf86cd799439020'),
      },
      {
        date: new Date('2025-01-20T10:00:00.000Z'),
        amount: 1,
        reason: 'Missed workout',
        planId: new Types.ObjectId('507f1f77bcf86cd799439020'),
      },
      {
        date: new Date('2025-01-10T10:00:00.000Z'),
        amount: 10,
        reason: 'Weekly plan cost',
        planId: new Types.ObjectId('507f1f77bcf86cd799439020'),
      },
      {
        date: new Date('2025-02-05T10:00:00.000Z'), // Different month
        amount: 1,
        reason: 'Missed workout',
        planId: new Types.ObjectId('507f1f77bcf86cd799439020'),
      },
    ],
  };

  const mockInvoice: Partial<MonthlyInvoiceDocument> = {
    _id: new Types.ObjectId(mockInvoiceId),
    clientId: new Types.ObjectId(mockClientProfileId),
    month: new Date('2025-01-01T00:00:00.000Z'),
    totalBalance: 12,
    planCosts: 10,
    penalties: 2,
    status: InvoiceStatus.UNPAID,
    dueDate: new Date('2025-01-31T23:59:59.999Z'),
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(async () => {
    // Mock constructor for MonthlyInvoice model
    mockInvoiceConstructor = jest.fn().mockImplementation((data) => ({
      ...data,
      ...mockInvoice,
      save: jest.fn().mockResolvedValue({ ...data, ...mockInvoice }),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getModelToken(ClientPayment.name),
          useValue: {},
        },
        {
          provide: getModelToken(MonthlyInvoice.name),
          useValue: Object.assign(mockInvoiceConstructor, {
            findOne: jest.fn(),
            findByIdAndUpdate: jest.fn(),
          }),
        },
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
        {
          provide: GamificationService,
          useValue: {
            clearBalance: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentModel = module.get(getModelToken(ClientPayment.name));
    invoiceModel = module.get(getModelToken(MonthlyInvoice.name)) as any;
    clientsService = module.get(ClientsService);
    gamificationService = module.get(GamificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMonthlyInvoice', () => {
    it('should return existing invoice if already exists for the month', async () => {
      const month = new Date('2025-01-15T10:00:00.000Z');
      // MERODAVNOST PROVERA: Servis koristi new Date(year, month, 1) što kreira datum u lokalnom timezone-u
      // Ne koristi UTC, tako da treba da očekujemo lokalni timezone
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);

      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockInvoice),
      });

      const result = await service.generateMonthlyInvoice(mockClientId, month);

      expect(result.invoice).toEqual(mockInvoice);
      expect(result.isNew).toBe(false);
      expect(invoiceModel.findOne).toHaveBeenCalledWith({
        clientId: new Types.ObjectId(mockClientProfileId),
        month: monthStart,
      });
      // MERODAVNOST PROVERA: Proveriti da se constructor NIJE pozvao jer već postoji invoice
      expect(mockInvoiceConstructor).not.toHaveBeenCalled();
    });

    it('should generate new invoice with correct calculations from penaltyHistory', async () => {
      const month = new Date('2025-01-15T10:00:00.000Z');
      // MERODAVNOST PROVERA: Servis koristi new Date(year, month, 1) i new Date(year, month + 1, 0, 23, 59, 59, 999)
      // što kreira datume u lokalnom timezone-u, ne UTC
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);

      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // No existing invoice
      });

      // Clear previous calls
      mockInvoiceConstructor.mockClear();

      const result = await service.generateMonthlyInvoice(mockClientId, month);

      // MERODAVNOST PROVERA: Proveriti da je constructor pozvan sa ispravnim podacima
      expect(mockInvoiceConstructor).toHaveBeenCalled();
      const constructorCall = mockInvoiceConstructor.mock.calls[0];
      const invoiceData = constructorCall[0];

      expect(invoiceData.clientId).toEqual(new Types.ObjectId(mockClientProfileId));
      // MERODAVNOST PROVERA: monthStart se kreira sa new Date(year, month, 1) što koristi lokalni timezone
      // Porediti samo year, month, day umesto direktnog poredjenja datuma
      expect(invoiceData.month.getFullYear()).toBe(monthStart.getFullYear());
      expect(invoiceData.month.getMonth()).toBe(monthStart.getMonth());
      expect(invoiceData.month.getDate()).toBe(monthStart.getDate());
      expect(invoiceData.totalBalance).toBe(12); // 2 penalties (1+1) + 10 plan cost
      expect(invoiceData.planCosts).toBe(10);
      expect(invoiceData.penalties).toBe(2);
      expect(invoiceData.status).toBe(InvoiceStatus.UNPAID);
      // MERODAVNOST PROVERA: monthEnd se kreira sa new Date(year, month + 1, 0, 23, 59, 59, 999) što koristi lokalni timezone
      // Porediti samo komponente umesto direktnog poredjenja datuma
      expect(invoiceData.dueDate.getFullYear()).toBe(monthEnd.getFullYear());
      expect(invoiceData.dueDate.getMonth()).toBe(monthEnd.getMonth());
      expect(invoiceData.dueDate.getDate()).toBe(monthEnd.getDate());
      expect(invoiceData.dueDate.getHours()).toBe(monthEnd.getHours());
      expect(invoiceData.dueDate.getMinutes()).toBe(monthEnd.getMinutes());
      expect(invoiceData.dueDate.getSeconds()).toBe(monthEnd.getSeconds());
      expect(invoiceData.dueDate.getMilliseconds()).toBe(monthEnd.getMilliseconds());

      // Proveriti da je save() pozvan
      const invoiceInstance = mockInvoiceConstructor.mock.results[0].value;
      expect(invoiceInstance.save).toHaveBeenCalled();
      expect(result.invoice).toBeDefined();
      expect(result.isNew).toBe(true);
    });

    it('should filter penalties correctly by date and reason', async () => {
      const month = new Date('2025-01-15T10:00:00.000Z');
      const monthStart = new Date('2025-01-01T00:00:00.000Z');
      const monthEnd = new Date('2025-01-31T23:59:59.999Z');

      // Client with penalties in different months
      const clientWithMultipleMonths = {
        ...mockClientProfile,
        penaltyHistory: [
          {
            date: new Date('2025-01-01T00:00:00.000Z'), // First day of month
            amount: 1,
            reason: 'Missed workout',
          },
          {
            date: new Date('2025-01-31T23:59:59.999Z'), // Last day of month
            amount: 1,
            reason: 'Missed workout',
          },
          {
            date: new Date('2025-02-01T00:00:00.000Z'), // Next month - should NOT be included
            amount: 1,
            reason: 'Missed workout',
          },
          {
            date: new Date('2024-12-31T23:59:59.999Z'), // Previous month - should NOT be included
            amount: 1,
            reason: 'Missed workout',
          },
          {
            date: new Date('2025-01-15T10:00:00.000Z'),
            amount: 10,
            reason: 'Weekly plan cost', // Different reason
          },
          {
            date: new Date('2025-01-20T10:00:00.000Z'),
            amount: 5,
            reason: 'Other reason', // Different reason - should NOT be included
          },
        ],
      };

      clientsService.getProfile.mockResolvedValue(clientWithMultipleMonths as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockInvoiceConstructor.mockClear();

      await service.generateMonthlyInvoice(mockClientId, month);

      // MERODAVNOST PROVERA: Proveriti da su penalties pravilno filtrirani
      expect(mockInvoiceConstructor).toHaveBeenCalled();
      const constructorCall = mockInvoiceConstructor.mock.calls[0];
      const invoiceData = constructorCall[0];

      // Should include: 2 Missed workout penalties (1+1) + 1 Weekly plan cost (10) = 12 total
      expect(invoiceData.penalties).toBe(2); // Only "Missed workout" penalties from Jan 2025
      expect(invoiceData.planCosts).toBe(10); // Only "Weekly plan cost" from Jan 2025
      expect(invoiceData.totalBalance).toBe(12); // 2 + 10
    });

    it('should handle client with no penaltyHistory', async () => {
      const month = new Date('2025-01-15T10:00:00.000Z');
      const clientWithNoHistory = {
        ...mockClientProfile,
        penaltyHistory: [],
      };

      clientsService.getProfile.mockResolvedValue(clientWithNoHistory as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockInvoiceConstructor.mockClear();

      await service.generateMonthlyInvoice(mockClientId, month);

      // MERODAVNOST PROVERA: Proveriti da su penalties i planCosts 0
      expect(mockInvoiceConstructor).toHaveBeenCalled();
      const constructorCall = mockInvoiceConstructor.mock.calls[0];
      const invoiceData = constructorCall[0];

      expect(invoiceData.penalties).toBe(0);
      expect(invoiceData.planCosts).toBe(0);
      expect(invoiceData.totalBalance).toBe(0);
    });

    it('should handle client with null penaltyHistory', async () => {
      const month = new Date('2025-01-15T10:00:00.000Z');
      const clientWithNullHistory = {
        ...mockClientProfile,
        penaltyHistory: null,
      };

      clientsService.getProfile.mockResolvedValue(clientWithNullHistory as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockInvoiceConstructor.mockClear();

      await service.generateMonthlyInvoice(mockClientId, month);

      // MERODAVNOST PROVERA: Proveriti da su penalties i planCosts 0
      expect(mockInvoiceConstructor).toHaveBeenCalled();
      const constructorCall = mockInvoiceConstructor.mock.calls[0];
      const invoiceData = constructorCall[0];

      expect(invoiceData.penalties).toBe(0);
      expect(invoiceData.planCosts).toBe(0);
      expect(invoiceData.totalBalance).toBe(0);
    });

    it('should handle edge case: penalty on first day of month at 00:00:00', async () => {
      const month = new Date('2025-01-15T10:00:00.000Z');
      const monthStart = new Date('2025-01-01T00:00:00.000Z');
      
      // MERODAVNOST PROVERA: Koristiti čist profil bez postojećeg penaltyHistory
      const clientWithFirstDayPenalty = {
        _id: mockClientProfile._id,
        userId: mockClientProfile.userId,
        penaltyHistory: [
          {
            date: new Date('2025-01-01T00:00:00.000Z'), // Exactly first day at 00:00:00
            amount: 1,
            reason: 'Missed workout',
          },
        ],
      };

      clientsService.getProfile.mockResolvedValue(clientWithFirstDayPenalty as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // MERODAVNOST PROVERA: Proveriti da se penalty na prvi dan meseca uračunava
      // Problem: mockInvoice ima penalties: 2, ali test očekuje 1
      // Rešenje: Proveriti constructor poziv, ne save() return value
      mockInvoiceConstructor.mockClear();
      mockInvoiceConstructor.mockImplementation((data) => {
        // Vratiti objekat sa podacima koji dolaze iz konstruktora
        const mockSave = jest.fn().mockResolvedValue({
          ...data,
          _id: mockInvoice._id,
          status: InvoiceStatus.UNPAID,
        });
        return {
          ...data,
          save: mockSave,
        };
      });

      const result = await service.generateMonthlyInvoice(mockClientId, month);

      // Proveriti konstruktor poziv
      expect(mockInvoiceConstructor).toHaveBeenCalled();
      const constructorCall = mockInvoiceConstructor.mock.calls[0];
      const invoiceData = constructorCall[0];
      expect(invoiceData.penalties).toBe(1);
      expect(invoiceData.totalBalance).toBe(1);

      // Proveriti save() return value
      expect(result.invoice.penalties).toBe(1);
      expect(result.invoice.totalBalance).toBe(1);
      expect(result.isNew).toBe(true);
    });

    it('should handle edge case: penalty on last day of month at 23:59:59.999', async () => {
      const month = new Date('2025-01-15T10:00:00.000Z');
      // MERODAVNOST PROVERA: Servis koristi new Date(year, month + 1, 0, 23, 59, 59, 999) što kreira datum u lokalnom timezone-u
      // Treba koristiti lokalni timezone i u testu
      const monthEnd = new Date(2025, 0, 31, 23, 59, 59, 999); // Januar = month 0
      
      // MERODAVNOST PROVERA: Koristiti čist profil bez postojećeg penaltyHistory
      // Koristiti lokalni timezone umesto UTC za penalty date
      const clientWithLastDayPenalty = {
        _id: mockClientProfile._id,
        userId: mockClientProfile.userId,
        penaltyHistory: [
          {
            date: new Date(2025, 0, 31, 23, 59, 59, 999), // Exactly last day at 23:59:59.999 (lokalni timezone)
            amount: 1,
            reason: 'Missed workout',
          },
        ],
      };

      clientsService.getProfile.mockResolvedValue(clientWithLastDayPenalty as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // MERODAVNOST PROVERA: Proveriti da se penalty na poslednji dan meseca uračunava
      // Problem: mockInvoice ima penalties: 2, ali test očekuje 1
      // Rešenje: Proveriti constructor poziv, ne save() return value
      mockInvoiceConstructor.mockClear();
      mockInvoiceConstructor.mockImplementation((data) => {
        // Vratiti objekat sa podacima koji dolaze iz konstruktora
        const mockSave = jest.fn().mockResolvedValue({
          ...data,
          _id: mockInvoice._id,
          status: InvoiceStatus.UNPAID,
        });
        return {
          ...data,
          save: mockSave,
        };
      });

      const result = await service.generateMonthlyInvoice(mockClientId, month);

      // Proveriti konstruktor poziv
      expect(mockInvoiceConstructor).toHaveBeenCalled();
      const constructorCall = mockInvoiceConstructor.mock.calls[0];
      const invoiceData = constructorCall[0];
      expect(invoiceData.penalties).toBe(1);
      expect(invoiceData.totalBalance).toBe(1);

      // Proveriti save() return value
      expect(result.invoice.penalties).toBe(1);
      expect(result.invoice.totalBalance).toBe(1);
      expect(result.isNew).toBe(true);
    });

    it('should handle February (no 31st day)', async () => {
      const month = new Date('2025-02-15T10:00:00.000Z');
      // MERODAVNOST PROVERA: Servis koristi new Date(year, month, 1) i new Date(year, month + 1, 0, 23, 59, 59, 999)
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999); // Last day of February

      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Capture the invoice data passed to constructor
      let capturedInvoice: any;
      const originalMock = invoiceModel as jest.Mock;
      originalMock.mockImplementation((data) => {
        capturedInvoice = data;
        expect(data.month).toEqual(monthStart);
        expect(data.dueDate).toEqual(monthEnd);
        return {
          ...data,
          ...mockInvoice,
          save: jest.fn().mockResolvedValue({ ...data, ...mockInvoice }),
        };
      });

      await service.generateMonthlyInvoice(mockClientId, month);

      expect(capturedInvoice).toBeDefined();
      expect(capturedInvoice.month).toEqual(monthStart);
      expect(capturedInvoice.dueDate).toEqual(monthEnd);
    });
  });

  describe('getMonthlyInvoice', () => {
    it('should return invoice for the month if exists', async () => {
      const month = new Date('2025-01-15T10:00:00.000Z');
      // MERODAVNOST PROVERA: Servis koristi new Date(year, month, 1) što kreira datum u lokalnom timezone-u
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);

      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockInvoice),
      });

      const result = await service.getMonthlyInvoice(mockClientId, month);

      expect(result).toEqual(mockInvoice);
      expect(invoiceModel.findOne).toHaveBeenCalledWith({
        clientId: new Types.ObjectId(mockClientProfileId),
        month: monthStart,
      });
    });

    it('should return null if invoice does not exist', async () => {
      const month = new Date('2025-01-15T10:00:00.000Z');

      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);

      (invoiceModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getMonthlyInvoice(mockClientId, month);

      expect(result).toBeNull();
    });
  });

  describe('markInvoiceAsPaid', () => {
    it('should mark invoice as paid and clear client balance', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        clientId: new Types.ObjectId(mockClientProfileId),
      };

      (invoiceModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(paidInvoice),
      });

      const result = await service.markInvoiceAsPaid(mockInvoiceId);

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(result.paidAt).toBeDefined();
      
      // KRITIČNO: Verify that clearBalance is called
      expect(gamificationService.clearBalance).toHaveBeenCalledWith(
        paidInvoice.clientId,
      );
    });

    it('should throw NotFoundException if invoice not found', async () => {
      (invoiceModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.markInvoiceAsPaid(mockInvoiceId)).rejects.toThrow(NotFoundException);
      await expect(service.markInvoiceAsPaid(mockInvoiceId)).rejects.toThrow('Invoice not found');
      
      // Should not call clearBalance if invoice not found
      expect(gamificationService.clearBalance).not.toHaveBeenCalled();
    });

    it('should update invoice with paidAt timestamp', async () => {
      const paidAtDate = new Date();
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        paidAt: paidAtDate, // Use actual Date object, not expect.any(Date)
        clientId: new Types.ObjectId(mockClientProfileId),
      };

      (invoiceModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(paidInvoice),
      });

      const result = await service.markInvoiceAsPaid(mockInvoiceId);

      // MERODAVNOST PROVERA: paidAt se postavlja u servisu kao new Date()
      // Mock vraća paidInvoice sa paidAt kao Date objektom
      expect(result.paidAt).toBeDefined();
      expect(result.paidAt).toBeInstanceOf(Date);
      expect(invoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockInvoiceId,
        {
          $set: {
            status: InvoiceStatus.PAID,
            paidAt: expect.any(Date),
          },
        },
        { new: true },
      );
    });
  });
});
