import { Test, TestingModule } from '@nestjs/testing';
import { CheckInsController } from './checkins.controller';
import { CheckInsService } from './checkins.service';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { CreateCheckInDto } from './dto/create-checkin.dto';
import { VerifyCheckInDto } from './dto/verify-checkin.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Types } from 'mongoose';

describe('CheckInsController', () => {
  let controller: CheckInsController;
  let checkInsService: jest.Mocked<CheckInsService>;

  const mockCheckInsService = {
    createCheckIn: jest.fn(),
    getCheckInsByClient: jest.fn(),
    getCheckInById: jest.fn(),
    verifyCheckIn: jest.fn(),
    getPendingCheckIns: jest.fn(),
    getCheckInsByDateRange: jest.fn(),
    deleteCheckIn: jest.fn(),
  };

  const mockClientsService = {
    getProfile: jest.fn(),
  };

  const mockTrainersService = {
    getProfileById: jest.fn(),
  };

  const mockCheckIn = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439050'),
    clientId: new Types.ObjectId('507f1f77bcf86cd799439021'),
    trainerId: new Types.ObjectId('507f1f77bcf86cd799439020'),
    checkinDate: new Date('2024-01-01'),
    photoUrl: 'http://example.com/photo.jpg',
    verificationStatus: VerificationStatus.PENDING,
  };

  const mockClientJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439012',
    email: 'client@test.com',
    role: 'CLIENT',
    iat: 1234567890,
    exp: 1234567890,
  };

  const mockTrainerJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439011',
    email: 'trainer@test.com',
    role: 'TRAINER',
    iat: 1234567890,
    exp: 1234567890,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckInsController],
      providers: [
        {
          provide: CheckInsService,
          useValue: mockCheckInsService,
        },
        {
          provide: ClientsService,
          useValue: mockClientsService,
        },
        {
          provide: TrainersService,
          useValue: mockTrainersService,
        },
      ],
    }).compile();

    controller = module.get<CheckInsController>(CheckInsController);
    checkInsService = module.get(CheckInsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCheckIn', () => {
    const createDto: CreateCheckInDto = {
      checkinDate: new Date('2024-01-01').toISOString(),
      photoUrl: 'http://example.com/photo.jpg',
      gpsCoordinates: { latitude: 10, longitude: 20 },
    };

    it('should create a check-in', async () => {
      checkInsService.createCheckIn.mockResolvedValue(mockCheckIn as any);

      const result = await controller.createCheckIn(mockClientJwtPayload, createDto);

      expect(checkInsService.createCheckIn).toHaveBeenCalledWith(mockClientJwtPayload.sub, createDto);
      expect(result).toEqual(mockCheckIn);
    });
  });

  describe('getCheckInsByClient', () => {
    it('should return check-ins for client', async () => {
      const mockCheckIns = [mockCheckIn];
      checkInsService.getCheckInsByClient.mockResolvedValue(mockCheckIns as any);

      const result = await controller.getCheckInsByClient(mockClientJwtPayload);

      expect(checkInsService.getCheckInsByClient).toHaveBeenCalledWith(mockClientJwtPayload.sub);
      expect(result).toEqual(mockCheckIns);
    });
  });

  describe('getCheckInById', () => {
    const checkInId = '507f1f77bcf86cd799439050';

    it('should return check-in by id', async () => {
      checkInsService.getCheckInById.mockResolvedValue(mockCheckIn as any);

      const result = await controller.getCheckInById(checkInId);

      expect(checkInsService.getCheckInById).toHaveBeenCalledWith(checkInId);
      expect(result).toEqual(mockCheckIn);
    });

    it('should throw NotFoundException if check-in not found', async () => {
      checkInsService.getCheckInById.mockRejectedValue(new NotFoundException('Check-in not found'));

      await expect(controller.getCheckInById(checkInId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyCheckIn', () => {
    const checkInId = '507f1f77bcf86cd799439050';
    const verifyDto: VerifyCheckInDto = {
      verificationStatus: VerificationStatus.APPROVED,
    };

    it('should verify check-in as trainer', async () => {
      const verifiedCheckIn = {
        ...mockCheckIn,
        verificationStatus: VerificationStatus.APPROVED,
        verifiedBy: new Types.ObjectId(mockTrainerJwtPayload.sub),
        verifiedAt: new Date(),
      };
      checkInsService.verifyCheckIn.mockResolvedValue(verifiedCheckIn as any);

      const result = await controller.verifyCheckIn(checkInId, mockTrainerJwtPayload, verifyDto);

      expect(checkInsService.verifyCheckIn).toHaveBeenCalledWith(
        checkInId,
        mockTrainerJwtPayload.sub,
        verifyDto,
      );
      expect(result).toEqual(verifiedCheckIn);
    });

    it('should throw ForbiddenException if trainer not authorized', async () => {
      checkInsService.verifyCheckIn.mockRejectedValue(
        new ForbiddenException('You are not authorized to verify this check-in'),
      );

      await expect(controller.verifyCheckIn(checkInId, mockTrainerJwtPayload, verifyDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getPendingCheckIns', () => {
    it('should return pending check-ins for trainer', async () => {
      const mockPendingCheckIns = [mockCheckIn];
      checkInsService.getPendingCheckIns.mockResolvedValue(mockPendingCheckIns as any);

      // Controller uses @CurrentUser('sub') which extracts sub directly as string
      const result = await controller.getPendingCheckIns(mockTrainerJwtPayload.sub);

      expect(checkInsService.getPendingCheckIns).toHaveBeenCalledWith(mockTrainerJwtPayload.sub);
      expect(result).toEqual(mockPendingCheckIns);
    });
  });

  describe('getCheckInsByDateRange', () => {
    const startDate = '2024-01-01';
    const endDate = '2024-01-31';

    it('should return check-ins within date range', async () => {
      const mockCheckIns = [mockCheckIn];
      checkInsService.getCheckInsByDateRange.mockResolvedValue(mockCheckIns as any);

      const result = await controller.getCheckInsByDateRange(mockClientJwtPayload, startDate, endDate);

      expect(checkInsService.getCheckInsByDateRange).toHaveBeenCalledWith(
        mockClientJwtPayload.sub,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toEqual(mockCheckIns);
    });
  });

  describe('deleteCheckIn', () => {
    const checkInId = '507f1f77bcf86cd799439050';

    it('should delete check-in', async () => {
      checkInsService.deleteCheckIn.mockResolvedValue(undefined);

      await controller.deleteCheckIn(mockClientJwtPayload, checkInId);

      expect(checkInsService.deleteCheckIn).toHaveBeenCalledWith(checkInId, mockClientJwtPayload.sub);
    });

    it('should throw ForbiddenException if client does not own check-in', async () => {
      checkInsService.deleteCheckIn.mockRejectedValue(
        new ForbiddenException('You can only delete your own check-ins'),
      );

      await expect(controller.deleteCheckIn(mockClientJwtPayload, checkInId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
