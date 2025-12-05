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
  });
});
