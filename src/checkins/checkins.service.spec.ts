import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CheckInsService } from './checkins.service';
import { CheckIn, CheckInDocument } from './schemas/checkin.schema';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import { CreateCheckInDto } from './dto/create-checkin.dto';
import { VerifyCheckInDto } from './dto/verify-checkin.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { ClientProfile, ClientProfileDocument } from '../clients/schemas/client-profile.schema';

describe('CheckInsService', () => {
  let service: CheckInsService;
  let checkInModel: Model<CheckInDocument>;
  let clientsService: jest.Mocked<ClientsService>;
  let trainersService: jest.Mocked<TrainersService>;

  const mockClientProfile: Partial<ClientProfileDocument> = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    trainerId: new Types.ObjectId(),
    toObject: jest.fn().mockReturnThis(),
  };

  const mockCheckIn: Partial<CheckInDocument> = {
    _id: new Types.ObjectId(),
    clientId: mockClientProfile._id as Types.ObjectId,
    trainerId: mockClientProfile.trainerId as Types.ObjectId,
    checkinDate: new Date('2025-01-01T00:00:00.000Z'),
    photoUrl: 'http://example.com/photo.jpg',
    gpsCoordinates: { latitude: 10, longitude: 20, accuracy: 10 },
    verificationStatus: VerificationStatus.PENDING,
    save: jest.fn().mockResolvedValue(this),
    toObject: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const mockModelConstructor = jest.fn((data: any) => {
      const instance = {
        ...mockCheckIn,
        ...data,
        save: jest.fn().mockResolvedValue({ ...mockCheckIn, ...data }),
      };
      return instance;
    });

    // Add static methods to constructor
    (mockModelConstructor as any).find = jest.fn().mockReturnThis();
    (mockModelConstructor as any).findById = jest.fn().mockReturnThis();
    (mockModelConstructor as any).findByIdAndDelete = jest.fn().mockReturnThis();
    (mockModelConstructor as any).populate = jest.fn().mockReturnThis();
    (mockModelConstructor as any).sort = jest.fn().mockReturnThis();
    (mockModelConstructor as any).exec = jest.fn().mockResolvedValue(mockCheckIn);
    (mockModelConstructor as any).create = jest.fn().mockResolvedValue(mockCheckIn);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInsService,
        {
          provide: getModelToken(CheckIn.name),
          useValue: mockModelConstructor,
        },
        {
          provide: ClientsService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
        {
          provide: TrainersService,
          useValue: {
            getProfile: jest.fn(),
            getProfileById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CheckInsService>(CheckInsService);
    checkInModel = module.get<Model<CheckInDocument>>(getModelToken(CheckIn.name));
    clientsService = module.get(ClientsService);
    trainersService = module.get(TrainersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckIn', () => {
    it('should create a new check-in with PENDING status', async () => {
      const createCheckInDto: CreateCheckInDto = {
        checkinDate: '2025-01-01T00:00:00.000Z',
        photoUrl: 'http://example.com/photo.jpg',
        gpsCoordinates: { latitude: 10, longitude: 20 },
        clientNotes: 'Great workout!',
      };

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const result = await service.createCheckIn('clientId1', createCheckInDto);

      expect(clientsService.getProfile).toHaveBeenCalledWith('clientId1');
      expect(result.verificationStatus).toBe(VerificationStatus.PENDING);
      expect(result.clientId).toBeDefined();
      expect(result.trainerId).toBeDefined();
    });

    it('should throw NotFoundException if client profile not found', async () => {
      const createCheckInDto: CreateCheckInDto = {
        checkinDate: '2025-01-01T00:00:00.000Z',
        photoUrl: 'http://example.com/photo.jpg',
        gpsCoordinates: { latitude: 10, longitude: 20 },
      };

      clientsService.getProfile.mockResolvedValue(null as any);

      await expect(service.createCheckIn('clientId1', createCheckInDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create check-in with workoutLogId if provided', async () => {
      const createCheckInDto: CreateCheckInDto = {
        workoutLogId: new Types.ObjectId().toString(),
        checkinDate: '2025-01-01T00:00:00.000Z',
        photoUrl: 'http://example.com/photo.jpg',
        gpsCoordinates: { latitude: 10, longitude: 20 },
      };

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);

      const result = await service.createCheckIn('clientId1', createCheckInDto);

      expect(result).toBeDefined();
    });
  });

  describe('getCheckInsByClient', () => {
    it('should return check-ins for a client', async () => {
      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);
      jest.spyOn(checkInModel, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockCheckIn]),
      } as any);

      const result = await service.getCheckInsByClient('clientId1');

      expect(result).toEqual([mockCheckIn]);
      expect((checkInModel as any).find).toHaveBeenCalledWith({
        clientId: (mockClientProfile as any)._id,
      });
    });

    it('should throw NotFoundException if client profile not found', async () => {
      clientsService.getProfile.mockResolvedValue(null as any);

      await expect(service.getCheckInsByClient('clientId1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCheckInById', () => {
    const mockUserId = '507f1f77bcf86cd799439012';
    const mockClientProfileId = mockClientProfile._id as Types.ObjectId;

    beforeEach(() => {
      (clientsService.getProfile as jest.Mock).mockResolvedValue({
        _id: mockClientProfileId,
        userId: mockClientProfile.userId,
      });
    });

    it('should return a check-in by ID for CLIENT role when check-in belongs to client', async () => {
      const validObjectId = new Types.ObjectId().toString();
      const checkInWithMatchingClientId = {
        ...mockCheckIn,
        clientId: mockClientProfileId,
      };
      
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(checkInWithMatchingClientId) } as any);

      const result = await service.getCheckInById(validObjectId, mockUserId, 'CLIENT');

      expect(result).toEqual(checkInWithMatchingClientId);
      expect((checkInModel as any).findById).toHaveBeenCalledWith(validObjectId);
      expect(clientsService.getProfile).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw ForbiddenException for CLIENT role when check-in does not belong to client', async () => {
      const validObjectId = new Types.ObjectId().toString();
      const differentClientId = new Types.ObjectId();
      const checkInWithDifferentClientId = {
        ...mockCheckIn,
        clientId: differentClientId,
      };
      
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(checkInWithDifferentClientId) } as any);

      await expect(service.getCheckInById(validObjectId, mockUserId, 'CLIENT')).rejects.toThrow(ForbiddenException);
      expect(clientsService.getProfile).toHaveBeenCalledWith(mockUserId);
    });

    it('should return a check-in by ID for TRAINER role when check-in belongs to trainer', async () => {
      const validObjectId = new Types.ObjectId().toString();
      const mockTrainerProfileId = new Types.ObjectId();
      const checkInWithMatchingTrainerId = {
        ...mockCheckIn,
        trainerId: mockTrainerProfileId,
      };
      
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(checkInWithMatchingTrainerId) } as any);

      (trainersService.getProfile as jest.Mock).mockResolvedValue({
        _id: mockTrainerProfileId,
        userId: mockUserId,
      });

      const result = await service.getCheckInById(validObjectId, mockUserId, 'TRAINER');

      expect(result).toEqual(checkInWithMatchingTrainerId);
      expect((checkInModel as any).findById).toHaveBeenCalledWith(validObjectId);
      expect(trainersService.getProfile).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw ForbiddenException for TRAINER role when check-in does not belong to trainer', async () => {
      const validObjectId = new Types.ObjectId().toString();
      const differentTrainerId = new Types.ObjectId();
      const checkInWithDifferentTrainerId = {
        ...mockCheckIn,
        trainerId: differentTrainerId,
      };
      
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(checkInWithDifferentTrainerId) } as any);

      const mockTrainerProfileId = new Types.ObjectId();
      (trainersService.getProfile as jest.Mock).mockResolvedValue({
        _id: mockTrainerProfileId,
        userId: mockUserId,
      });

      await expect(service.getCheckInById(validObjectId, mockUserId, 'TRAINER')).rejects.toThrow(ForbiddenException);
      expect(trainersService.getProfile).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw NotFoundException if check-in not found', async () => {
      const validObjectId = new Types.ObjectId().toString();
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) } as any);

      await expect(service.getCheckInById(validObjectId, mockUserId, 'CLIENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyCheckIn', () => {
    it('should verify a check-in and update status to APPROVED', async () => {
      const verifyCheckInDto: VerifyCheckInDto = {
        verificationStatus: VerificationStatus.APPROVED,
      };

      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      const checkInWithSave = {
        ...mockCheckIn,
        trainerId: trainerProfileId,
        save: jest.fn().mockResolvedValue({
          ...mockCheckIn,
          verificationStatus: VerificationStatus.APPROVED,
          verifiedBy: trainerProfileId,
          verifiedAt: expect.any(Date),
        }),
      };

      trainersService.getProfile.mockResolvedValue(trainerProfile as any);
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(checkInWithSave) } as any);

      const result = await service.verifyCheckIn('checkInId1', trainerId.toString(), verifyCheckInDto);

      expect(result.verificationStatus).toBe(VerificationStatus.APPROVED);
      expect(checkInWithSave.save).toHaveBeenCalled();
    });

    it('should verify a check-in and update status to REJECTED with reason', async () => {
      const verifyCheckInDto: VerifyCheckInDto = {
        verificationStatus: VerificationStatus.REJECTED,
        rejectionReason: 'Photo does not show gym equipment',
      };

      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      const checkInWithSave = {
        ...mockCheckIn,
        trainerId: trainerProfileId,
        save: jest.fn().mockResolvedValue({
          ...mockCheckIn,
          verificationStatus: VerificationStatus.REJECTED,
          rejectionReason: verifyCheckInDto.rejectionReason,
          verifiedBy: trainerProfileId,
          verifiedAt: expect.any(Date),
        }),
      };

      trainersService.getProfile.mockResolvedValue(trainerProfile as any);
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(checkInWithSave) } as any);

      const result = await service.verifyCheckIn('checkInId1', trainerId.toString(), verifyCheckInDto);

      expect(result.verificationStatus).toBe(VerificationStatus.REJECTED);
      expect(result.rejectionReason).toBe(verifyCheckInDto.rejectionReason);
    });

    it('should throw NotFoundException if check-in not found', async () => {
      const verifyCheckInDto: VerifyCheckInDto = {
        verificationStatus: VerificationStatus.APPROVED,
      };

      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) } as any);

      await expect(
        service.verifyCheckIn('nonExistentId', 'trainerId1', verifyCheckInDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if trainer is not authorized', async () => {
      const verifyCheckInDto: VerifyCheckInDto = {
        verificationStatus: VerificationStatus.APPROVED,
      };

      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const otherTrainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      const checkInWithDifferentTrainer = {
        ...mockCheckIn,
        trainerId: otherTrainerProfileId,
      };

      trainersService.getProfile.mockResolvedValue(trainerProfile as any);
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({
          exec: jest.fn().mockResolvedValue(checkInWithDifferentTrainer),
        } as any);

      await expect(
        service.verifyCheckIn('checkInId1', trainerId.toString(), verifyCheckInDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPendingCheckIns', () => {
    it('should return pending check-ins for a trainer', async () => {
      const trainerId = new Types.ObjectId();
      const trainerProfileId = new Types.ObjectId();
      const trainerProfile = {
        _id: trainerProfileId,
        userId: trainerId,
      };
      trainersService.getProfile.mockResolvedValue(trainerProfile as any);
      jest.spyOn(checkInModel, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockCheckIn]),
      } as any);

      const result = await service.getPendingCheckIns(trainerProfileId.toString());

      expect(result).toEqual([mockCheckIn]);
      expect((checkInModel as any).find).toHaveBeenCalledWith({
        trainerId: trainerProfileId,
        verificationStatus: VerificationStatus.PENDING,
      });
    });
  });

  describe('getCheckInsByDateRange', () => {
    it('should return check-ins within date range', async () => {
      const startDate = new Date('2025-01-01T00:00:00.000Z');
      const endDate = new Date('2025-01-31T23:59:59.999Z');

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);
      jest.spyOn(checkInModel, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockCheckIn]),
      } as any);

      const result = await service.getCheckInsByDateRange('clientId1', startDate, endDate);

      expect(result).toEqual([mockCheckIn]);
      expect((checkInModel as any).find).toHaveBeenCalledWith({
        clientId: (mockClientProfile as any)._id,
        checkinDate: { $gte: startDate, $lte: endDate },
      });
    });

    it('should throw NotFoundException if client profile not found', async () => {
      const startDate = new Date('2025-01-01T00:00:00.000Z');
      const endDate = new Date('2025-01-31T23:59:59.999Z');

      clientsService.getProfile.mockResolvedValue(null as any);

      await expect(
        service.getCheckInsByDateRange('clientId1', startDate, endDate),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCheckIn', () => {
    it('should delete check-in if client owns it', async () => {
      const checkInId = '507f1f77bcf86cd799439050';
      const checkInWithClientId = {
        ...mockCheckIn,
        clientId: (mockClientProfile as any)._id,
      };

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(checkInWithClientId) } as any);
      jest.spyOn(checkInModel, 'findByIdAndDelete').mockReturnValue({
        exec: jest.fn().mockResolvedValue(checkInWithClientId),
      } as any);

      await service.deleteCheckIn(checkInId, 'clientId1');

      expect((checkInModel as any).findByIdAndDelete).toHaveBeenCalledWith(checkInId);
    });

    it('should throw NotFoundException if check-in not found', async () => {
      const checkInId = '507f1f77bcf86cd799439050';

      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) } as any);

      await expect(service.deleteCheckIn(checkInId, 'clientId1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if client does not own check-in', async () => {
      const checkInId = '507f1f77bcf86cd799439050';
      const otherClientId = new Types.ObjectId();
      const checkInWithOtherClient = {
        ...mockCheckIn,
        clientId: otherClientId,
      };

      clientsService.getProfile.mockResolvedValue(mockClientProfile as ClientProfileDocument);
      jest
        .spyOn(checkInModel, 'findById')
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(checkInWithOtherClient) } as any);

      await expect(service.deleteCheckIn(checkInId, 'clientId1')).rejects.toThrow(ForbiddenException);
    });
  });
});

