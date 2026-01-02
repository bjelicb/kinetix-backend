import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { ClientsService } from '../clients/clients.service';
import { TrainersService } from '../trainers/trainers.service';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

describe('MediaController', () => {
  let controller: MediaController;
  let mediaService: jest.Mocked<MediaService>;

  const mockMediaService = {
    getUploadSignature: jest.fn(),
  };

  const mockClientsService = {
    getProfile: jest.fn(),
  };

  const mockTrainersService = {
    getProfileById: jest.fn(),
  };

  const mockClientJwtPayload: JwtPayload = {
    sub: '507f1f77bcf86cd799439012',
    email: 'client@test.com',
    role: 'CLIENT',
    iat: 1234567890,
    exp: 1234567890,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: mockMediaService,
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

    controller = module.get<MediaController>(MediaController);
    mediaService = module.get(MediaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUploadSignature', () => {
    it('should return Cloudinary upload signature', async () => {
      const mockSignature = {
        signature: 'mock_signature',
        timestamp: 1234567890,
        cloudName: 'test_cloud',
        apiKey: 'test_api_key',
        uploadPreset: 'test_preset',
        folder: 'checkins/client_507f1f77bcf86cd799439012',
      };
      mediaService.getUploadSignature.mockReturnValue(mockSignature);

      const result = await controller.getUploadSignature(mockClientJwtPayload);

      expect(mediaService.getUploadSignature).toHaveBeenCalledWith(mockClientJwtPayload.sub);
      expect(result).toEqual(mockSignature);
      expect(result).toHaveProperty('signature');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('cloudName');
      expect(result).toHaveProperty('apiKey');
      expect(result).toHaveProperty('uploadPreset');
      expect(result).toHaveProperty('folder');
    });

    it('should handle error when MediaService fails', async () => {
      mediaService.getUploadSignature.mockImplementation(() => {
        throw new Error('Cloudinary service error');
      });

      await expect(
        controller.getUploadSignature(mockClientJwtPayload),
      ).rejects.toThrow('Cloudinary service error');
    });

    it('should handle invalid user ID format', async () => {
      const invalidPayload = {
        ...mockClientJwtPayload,
        sub: 'invalid-id',
      };
      mediaService.getUploadSignature.mockImplementation(() => {
        throw new Error('Invalid user ID');
      });

      await expect(
        controller.getUploadSignature(invalidPayload),
      ).rejects.toThrow('Invalid user ID');
    });
  });

  describe('getBatchSignatures', () => {
    it('should return batch Cloudinary upload signatures', async () => {
      const mockSignatures = [
        {
          signature: 'mock_signature_1',
          timestamp: 1234567890,
          cloudName: 'test_cloud',
          apiKey: 'test_api_key',
          uploadPreset: 'test_preset',
          folder: 'checkins/client_507f1f77bcf86cd799439012',
        },
        {
          signature: 'mock_signature_2',
          timestamp: 1234567891,
          cloudName: 'test_cloud',
          apiKey: 'test_api_key',
          uploadPreset: 'test_preset',
          folder: 'checkins/client_507f1f77bcf86cd799439012',
        },
      ];
      mediaService.getBatchSignatures = jest.fn().mockReturnValue(mockSignatures);

      const result = await controller.getBatchSignatures(mockClientJwtPayload, 2);

      expect(mediaService.getBatchSignatures).toHaveBeenCalledWith(mockClientJwtPayload.sub, 2);
      expect(result).toEqual(mockSignatures);
      expect(result).toHaveLength(2);
    });

    it('should throw BadRequestException if count is less than 1', async () => {
      await expect(
        controller.getBatchSignatures(mockClientJwtPayload, 0),
      ).rejects.toThrow('Count must be between 1 and 10');
    });

    it('should throw BadRequestException if count is greater than 10', async () => {
      await expect(
        controller.getBatchSignatures(mockClientJwtPayload, 11),
      ).rejects.toThrow('Count must be between 1 and 10');
    });

    it('should throw BadRequestException if count is missing', async () => {
      await expect(
        controller.getBatchSignatures(mockClientJwtPayload, undefined as any),
      ).rejects.toThrow('Count must be between 1 and 10');
    });

    it('should handle error when MediaService fails', async () => {
      mediaService.getBatchSignatures = jest.fn().mockImplementation(() => {
        throw new Error('Cloudinary service error');
      });

      await expect(
        controller.getBatchSignatures(mockClientJwtPayload, 5),
      ).rejects.toThrow('Cloudinary service error');
    });

    it('should accept count of 1', async () => {
      const mockSignatures = [
        {
          signature: 'mock_signature_1',
          timestamp: 1234567890,
          cloudName: 'test_cloud',
          apiKey: 'test_api_key',
          uploadPreset: 'test_preset',
          folder: 'checkins/client_507f1f77bcf86cd799439012',
        },
      ];
      mediaService.getBatchSignatures = jest.fn().mockReturnValue(mockSignatures);

      const result = await controller.getBatchSignatures(mockClientJwtPayload, 1);

      expect(result).toHaveLength(1);
    });

    it('should accept count of 10', async () => {
      const mockSignatures = Array.from({ length: 10 }, (_, i) => ({
        signature: `mock_signature_${i + 1}`,
        timestamp: 1234567890 + i,
        cloudName: 'test_cloud',
        apiKey: 'test_api_key',
        uploadPreset: 'test_preset',
        folder: 'checkins/client_507f1f77bcf86cd799439012',
      }));
      mediaService.getBatchSignatures = jest.fn().mockReturnValue(mockSignatures);

      const result = await controller.getBatchSignatures(mockClientJwtPayload, 10);

      expect(result).toHaveLength(10);
    });
  });
});
