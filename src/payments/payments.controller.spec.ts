import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { MonthlyInvoice, MonthlyInvoiceDocument, InvoiceStatus } from './schemas/monthly-invoice.schema';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Response } from 'express';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<PaymentsService>;
  let clientsService: jest.Mocked<ClientsService>;
  let trainersService: jest.Mocked<TrainersService>;
  let invoiceModel: jest.Mocked<Model<MonthlyInvoiceDocument>>;

  const mockClientId = '507f1f77bcf86cd799439011';
  const mockClientProfileId = '507f1f77bcf86cd799439012';
  const mockTrainerId = '507f1f77bcf86cd799439013';
  const mockInvoiceId = '507f1f77bcf86cd799439014';

  const mockClientJwtPayload: JwtPayload = {
    sub: mockClientId,
    email: 'client@test.com',
    role: UserRole.CLIENT,
    iat: 1234567890,
    exp: 1234567890,
  };

  const mockTrainerJwtPayload: JwtPayload = {
    sub: mockTrainerId,
    email: 'trainer@test.com',
    role: UserRole.TRAINER,
    iat: 1234567890,
    exp: 1234567890,
  };

  const mockAdminJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439015',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    iat: 1234567890,
    exp: 1234567890,
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
    toObject: jest.fn().mockReturnThis(),
    toString: jest.fn().mockReturnValue(mockInvoiceId),
  };

  const mockClientProfile = {
    _id: new Types.ObjectId(mockClientProfileId),
    userId: new Types.ObjectId(mockClientId),
    trainerId: new Types.ObjectId(mockTrainerId),
  };

  const mockTrainerProfile = {
    _id: new Types.ObjectId(mockTrainerId),
    userId: new Types.ObjectId(mockTrainerId),
  };

  const mockPaymentsService = {
    generateMonthlyInvoice: jest.fn(),
    getMonthlyInvoice: jest.fn(),
    markInvoiceAsPaid: jest.fn(),
  };

  const mockClientsService = {
    getProfile: jest.fn(),
  };

  const mockTrainersService = {
    getProfile: jest.fn(),
  };

  const mockInvoiceModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: ClientsService,
          useValue: mockClientsService,
        },
        {
          provide: TrainersService,
          useValue: mockTrainersService,
        },
        {
          provide: getModelToken(MonthlyInvoice.name),
          useValue: mockInvoiceModel,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get(PaymentsService);
    clientsService = module.get(ClientsService);
    trainersService = module.get(TrainersService);
    invoiceModel = module.get(getModelToken(MonthlyInvoice.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateInvoice', () => {
    const validMonth = '2025-01-15T00:00:00.000Z';
    const dto: GenerateInvoiceDto = {
      month: validMonth,
    };

    it('should generate new invoice and return 201 status', async () => {
      // MERODAVNOST: Proverava da se generiše novi invoice i vraća 201 status
      const mockResult = {
        invoice: mockInvoice,
        isNew: true,
      };

      paymentsService.generateMonthlyInvoice.mockResolvedValue(mockResult as any);

      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.generateInvoice(dto, mockClientJwtPayload, mockResponse);

      expect(paymentsService.generateMonthlyInvoice).toHaveBeenCalledWith(
        mockClientId,
        new Date(validMonth),
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockInvoice,
          timestamp: expect.any(String),
        }),
      );
    });

    it('should return existing invoice with 200 status', async () => {
      // MERODAVNOST: Proverava da se vraća postojeći invoice sa 200 statusom
      const mockResult = {
        invoice: mockInvoice,
        isNew: false,
      };

      paymentsService.generateMonthlyInvoice.mockResolvedValue(mockResult as any);

      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.generateInvoice(dto, mockClientJwtPayload, mockResponse);

      expect(paymentsService.generateMonthlyInvoice).toHaveBeenCalledWith(
        mockClientId,
        new Date(validMonth),
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockInvoice,
          timestamp: expect.any(String),
        }),
      );
    });

    it('should throw ForbiddenException for invalid month date format', async () => {
      // MERODAVNOST: Proverava validaciju invalid date formata
      const invalidDto: GenerateInvoiceDto = {
        month: 'invalid-date',
      };

      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await expect(
        controller.generateInvoice(invalidDto, mockClientJwtPayload, mockResponse),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.generateInvoice(invalidDto, mockClientJwtPayload, mockResponse),
      ).rejects.toThrow('Invalid month date format');
      expect(paymentsService.generateMonthlyInvoice).not.toHaveBeenCalled();
    });

    it('should propagate error from PaymentsService', async () => {
      // MERODAVNOST: Proverava error handling kada service baca grešku
      const error = new Error('Service error');
      paymentsService.generateMonthlyInvoice.mockRejectedValue(error);

      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await expect(
        controller.generateInvoice(dto, mockClientJwtPayload, mockResponse),
      ).rejects.toThrow('Service error');
    });
  });

  describe('getInvoice', () => {
    const validMonth = '2025-01-15T00:00:00.000Z';
    const clientId = mockClientId;

    it('should return invoice for CLIENT accessing their own invoice', async () => {
      // MERODAVNOST: Proverava RBAC - CLIENT može pristupiti svom invoice-u
      paymentsService.getMonthlyInvoice.mockResolvedValue(mockInvoice as any);

      const result = await controller.getInvoice(clientId, validMonth, mockClientJwtPayload);

      expect(paymentsService.getMonthlyInvoice).toHaveBeenCalledWith(
        clientId,
        new Date(validMonth),
      );
      expect(result).toEqual(mockInvoice);
    });

    it('should throw ForbiddenException when CLIENT tries to access another client invoice', async () => {
      // MERODAVNOST: Proverava RBAC - CLIENT ne može pristupiti tuđem invoice-u
      const otherClientId = '507f1f77bcf86cd799439020';

      await expect(
        controller.getInvoice(otherClientId, validMonth, mockClientJwtPayload),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.getInvoice(otherClientId, validMonth, mockClientJwtPayload),
      ).rejects.toThrow('You can only access your own invoices');
      expect(paymentsService.getMonthlyInvoice).not.toHaveBeenCalled();
    });

    it('should return invoice for TRAINER accessing their client invoice', async () => {
      // MERODAVNOST: Proverava RBAC - TRAINER može pristupiti invoice-u svog klijenta
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      paymentsService.getMonthlyInvoice.mockResolvedValue(mockInvoice as any);

      const result = await controller.getInvoice(clientId, validMonth, mockTrainerJwtPayload);

      expect(trainersService.getProfile).toHaveBeenCalledWith(mockTrainerId);
      expect(clientsService.getProfile).toHaveBeenCalledWith(clientId);
      expect(paymentsService.getMonthlyInvoice).toHaveBeenCalledWith(
        clientId,
        new Date(validMonth),
      );
      expect(result).toEqual(mockInvoice);
    });

    it('should throw ForbiddenException when TRAINER tries to access invoice of client who is not theirs', async () => {
      // MERODAVNOST: Proverava RBAC - TRAINER ne može pristupiti invoice-u klijenta koji nije njegov
      const otherClientId = '507f1f77bcf86cd799439020';
      const otherClientProfile = {
        _id: new Types.ObjectId('507f1f77bcf86cd799439021'),
        userId: new Types.ObjectId(otherClientId),
        trainerId: new Types.ObjectId('507f1f77bcf86cd799439022'), // Different trainer
      };

      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      clientsService.getProfile.mockResolvedValue(otherClientProfile as any);

      await expect(
        controller.getInvoice(otherClientId, validMonth, mockTrainerJwtPayload),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.getInvoice(otherClientId, validMonth, mockTrainerJwtPayload),
      ).rejects.toThrow('You can only access invoices of your clients');
      expect(paymentsService.getMonthlyInvoice).not.toHaveBeenCalled();
    });

    it('should return invoice for ADMIN accessing any invoice', async () => {
      // MERODAVNOST: Proverava RBAC - ADMIN može pristupiti bilo kom invoice-u
      paymentsService.getMonthlyInvoice.mockResolvedValue(mockInvoice as any);

      const result = await controller.getInvoice(clientId, validMonth, mockAdminJwtPayload);

      expect(paymentsService.getMonthlyInvoice).toHaveBeenCalledWith(
        clientId,
        new Date(validMonth),
      );
      expect(result).toEqual(mockInvoice);
    });

    it('should throw ForbiddenException for invalid month date format', async () => {
      // MERODAVNOST: Proverava validaciju invalid date formata
      const invalidMonth = 'invalid-date';

      await expect(
        controller.getInvoice(clientId, invalidMonth, mockClientJwtPayload),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.getInvoice(clientId, invalidMonth, mockClientJwtPayload),
      ).rejects.toThrow('Invalid month date format');
      expect(paymentsService.getMonthlyInvoice).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when invoice not found', async () => {
      // MERODAVNOST: Proverava error handling kada invoice ne postoji
      paymentsService.getMonthlyInvoice.mockResolvedValue(null);

      await expect(
        controller.getInvoice(clientId, validMonth, mockClientJwtPayload),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.getInvoice(clientId, validMonth, mockClientJwtPayload),
      ).rejects.toThrow('Invoice not found for this month');
    });

    it('should throw ForbiddenException when TRAINER tries to access invoice but client not found', async () => {
      // MERODAVNOST: Proverava error handling kada TRAINER pokušava pristupiti invoice-u ali klijent ne postoji
      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      clientsService.getProfile.mockRejectedValue(new NotFoundException('Client profile not found'));

      await expect(
        controller.getInvoice(clientId, validMonth, mockTrainerJwtPayload),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.getInvoice(clientId, validMonth, mockTrainerJwtPayload),
      ).rejects.toThrow('Client not found or access denied');
      expect(paymentsService.getMonthlyInvoice).not.toHaveBeenCalled();
    });

    it('should propagate error from PaymentsService', async () => {
      // MERODAVNOST: Proverava error handling kada service baca grešku
      const error = new Error('Service error');
      paymentsService.getMonthlyInvoice.mockRejectedValue(error);

      await expect(
        controller.getInvoice(clientId, validMonth, mockClientJwtPayload),
      ).rejects.toThrow('Service error');
    });

    it('should handle TRAINER case when client trainerId is populated object', async () => {
      // MERODAVNOST: Proverava edge case kada trainerId je populated object
      const populatedClientProfile = {
        _id: new Types.ObjectId(mockClientProfileId),
        userId: new Types.ObjectId(mockClientId),
        trainerId: {
          _id: new Types.ObjectId(mockTrainerId),
        },
      };

      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      clientsService.getProfile.mockResolvedValue(populatedClientProfile as any);
      paymentsService.getMonthlyInvoice.mockResolvedValue(mockInvoice as any);

      const result = await controller.getInvoice(clientId, validMonth, mockTrainerJwtPayload);

      expect(result).toEqual(mockInvoice);
    });

    it('should handle TRAINER case when client trainerId is string', async () => {
      // MERODAVNOST: Proverava edge case kada trainerId je string
      const stringTrainerIdClientProfile = {
        _id: new Types.ObjectId(mockClientProfileId),
        userId: new Types.ObjectId(mockClientId),
        trainerId: mockTrainerId,
      };

      trainersService.getProfile.mockResolvedValue(mockTrainerProfile as any);
      clientsService.getProfile.mockResolvedValue(stringTrainerIdClientProfile as any);
      paymentsService.getMonthlyInvoice.mockResolvedValue(mockInvoice as any);

      const result = await controller.getInvoice(clientId, validMonth, mockTrainerJwtPayload);

      expect(result).toEqual(mockInvoice);
    });
  });

  describe('markInvoiceAsPaid', () => {
    const invoiceId = mockInvoiceId;

    it('should mark invoice as paid for CLIENT', async () => {
      // MERODAVNOST: Proverava da CLIENT može označiti svoj invoice kao plaćen
      const mockInvoiceDoc = {
        ...mockInvoice,
        clientId: new Types.ObjectId(mockClientProfileId),
        exec: jest.fn().mockResolvedValue(mockInvoice),
      };

      invoiceModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockInvoiceDoc),
      }) as any;

      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      paymentsService.markInvoiceAsPaid.mockResolvedValue(mockInvoice as any);

      const result = await controller.markInvoiceAsPaid(invoiceId, mockClientJwtPayload);

      expect(invoiceModel.findById).toHaveBeenCalledWith(invoiceId);
      expect(clientsService.getProfile).toHaveBeenCalledWith(mockClientId);
      expect(paymentsService.markInvoiceAsPaid).toHaveBeenCalledWith(invoiceId);
      expect(result).toEqual(mockInvoice);
    });

    it('should throw NotFoundException when invoice not found', async () => {
      // MERODAVNOST: Proverava error handling kada invoice ne postoji
      invoiceModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }) as any;

      await expect(
        controller.markInvoiceAsPaid(invoiceId, mockClientJwtPayload),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.markInvoiceAsPaid(invoiceId, mockClientJwtPayload),
      ).rejects.toThrow('Invoice not found');
      expect(paymentsService.markInvoiceAsPaid).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when CLIENT tries to pay another client invoice', async () => {
      // MERODAVNOST: Proverava RBAC - CLIENT ne može platiti tuđi invoice
      const otherClientProfileId = '507f1f77bcf86cd799439020';
      const mockInvoiceDoc = {
        ...mockInvoice,
        clientId: new Types.ObjectId(otherClientProfileId),
        exec: jest.fn().mockResolvedValue(mockInvoice),
      };

      invoiceModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockInvoiceDoc),
      }) as any;

      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);

      await expect(
        controller.markInvoiceAsPaid(invoiceId, mockClientJwtPayload),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.markInvoiceAsPaid(invoiceId, mockClientJwtPayload),
      ).rejects.toThrow('You can only pay your own invoices');
      expect(paymentsService.markInvoiceAsPaid).not.toHaveBeenCalled();
    });

    it('should propagate error from PaymentsService', async () => {
      // MERODAVNOST: Proverava error handling kada service baca grešku
      const mockInvoiceDoc = {
        ...mockInvoice,
        clientId: new Types.ObjectId(mockClientProfileId),
        exec: jest.fn().mockResolvedValue(mockInvoice),
      };

      invoiceModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockInvoiceDoc),
      }) as any;

      clientsService.getProfile.mockResolvedValue(mockClientProfile as any);
      const error = new Error('Service error');
      paymentsService.markInvoiceAsPaid.mockRejectedValue(error);

      await expect(
        controller.markInvoiceAsPaid(invoiceId, mockClientJwtPayload),
      ).rejects.toThrow('Service error');
    });
  });
});
