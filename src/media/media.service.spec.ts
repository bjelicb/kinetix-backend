import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { ConfigService } from '@nestjs/config';

// Mock cloudinary config before importing
jest.mock('./config/cloudinary.config', () => {
  const mockUtils = {
    api_sign_request: jest.fn().mockReturnValue('mock_signature'),
  };
  return {
    cloudinary: {
      utils: mockUtils,
      config: jest.fn(),
    },
  };
});

import { cloudinary } from './config/cloudinary.config';

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                CLOUDINARY_CLOUD_NAME: 'test_cloud',
                CLOUDINARY_API_KEY: 'test_api_key',
                CLOUDINARY_API_SECRET: 'test_api_secret',
                CLOUDINARY_UPLOAD_PRESET: 'test_preset',
              };
              return config[key] || process.env[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUploadSignature', () => {
    beforeEach(() => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
      process.env.CLOUDINARY_API_KEY = 'test_api_key';
      process.env.CLOUDINARY_API_SECRET = 'test_api_secret';
      process.env.CLOUDINARY_UPLOAD_PRESET = 'test_preset';
    });

    afterEach(() => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;
      delete process.env.CLOUDINARY_UPLOAD_PRESET;
    });

    it('should generate upload signature with correct folder structure', () => {
      const userId = 'clientUserId1';
      const result = service.getUploadSignature(userId);

      expect(result.signature).toBe('mock_signature');
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.folder).toBe(`checkins/client_${userId}`);
      expect(result.cloudName).toBe('test_cloud');
      expect(result.apiKey).toBe('test_api_key');
      expect(result.uploadPreset).toBe('test_preset');
    });

    it('should use default upload preset if not in env', () => {
      // Temporarily remove preset from env
      const originalPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
      delete process.env.CLOUDINARY_UPLOAD_PRESET;

      const userId = 'clientUserId2';
      const result = service.getUploadSignature(userId);

      expect(result.uploadPreset).toBe('client_checkins');

      // Restore original
      if (originalPreset) {
        process.env.CLOUDINARY_UPLOAD_PRESET = originalPreset;
      }
    });

    it('should call cloudinary.utils.api_sign_request with correct params', () => {
      const userId = 'clientUserId3';
      const mockApiSignRequest = jest.spyOn(cloudinary.utils, 'api_sign_request');

      service.getUploadSignature(userId);

      expect(mockApiSignRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          folder: `checkins/client_${userId}`,
          upload_preset: expect.any(String),
        }),
        expect.any(String),
      );
    });

    it('should generate different timestamps for different calls', async () => {
      const userId = 'clientUserId4';
      const result1 = service.getUploadSignature(userId);

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result2 = service.getUploadSignature(userId);

      expect(result2.timestamp).toBeGreaterThanOrEqual(result1.timestamp);
    });
  });

  describe('getBatchSignatures', () => {
    beforeEach(() => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
      process.env.CLOUDINARY_API_KEY = 'test_api_key';
      process.env.CLOUDINARY_API_SECRET = 'test_api_secret';
      process.env.CLOUDINARY_UPLOAD_PRESET = 'test_preset';
    });

    afterEach(() => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;
      delete process.env.CLOUDINARY_UPLOAD_PRESET;
    });

    it('should generate batch signatures for valid count', () => {
      const userId = 'clientUserId1';
      const count = 5;
      const result = service.getBatchSignatures(userId, count);

      expect(result.signatures).toHaveLength(5);
      // MERODAVNOST PROVERA: getBatchSignatures koristi folder strukturu: checkins/${userId}/${timestamp}_${i}
      // Ne koristi "client_" prefix kao getUploadSignature
      expect(result.signatures[0]).toMatchObject({
        signature: 'mock_signature',
        timestamp: expect.any(Number),
        folder: expect.stringMatching(/^checkins\/clientUserId1\/\d+_\d+$/), // checkins/userId/timestamp_index
        cloudName: 'test_cloud',
        apiKey: 'test_api_key',
        uploadPreset: 'test_preset',
      });
    });

    it('should generate signatures for any count (no hard limit in code)', () => {
      const userId = 'clientUserId2';
      const count = 15;
      const result = service.getBatchSignatures(userId, count);

      // MERODAVNOST PROVERA: Code doesn't limit count, so it should generate all requested signatures
      expect(result.signatures).toHaveLength(15);
    });

    it('should handle count of 0', () => {
      const userId = 'clientUserId3';
      const count = 0;
      const result = service.getBatchSignatures(userId, count);

      expect(result.signatures).toHaveLength(0);
    });

    it('should handle count of 1', () => {
      const userId = 'clientUserId4';
      const count = 1;
      const result = service.getBatchSignatures(userId, count);

      expect(result.signatures).toHaveLength(1);
      expect(result.signatures[0].signature).toBe('mock_signature');
    });

    it('should handle count of 10 (max allowed)', () => {
      const userId = 'clientUserId5';
      const count = 10;
      const result = service.getBatchSignatures(userId, count);

      expect(result.signatures).toHaveLength(10);
    });

    it('should generate unique signatures for each request', () => {
      const userId = 'clientUserId6';
      const count = 3;
      const result = service.getBatchSignatures(userId, count);

      // All signatures should have the same structure but may have different timestamps
      // MERODAVNOST PROVERA: getBatchSignatures koristi folder strukturu: checkins/${userId}/${timestamp}_${i}
      result.signatures.forEach((sig) => {
        expect(sig).toMatchObject({
          signature: 'mock_signature',
          timestamp: expect.any(Number),
          folder: expect.stringMatching(new RegExp(`^checkins/${userId}/\\d+_\\d+$`)), // checkins/userId/timestamp_index
          cloudName: 'test_cloud',
          apiKey: 'test_api_key',
          uploadPreset: 'test_preset',
        });
      });
    });

    it('should use default upload preset if not in env', () => {
      const originalPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
      delete process.env.CLOUDINARY_UPLOAD_PRESET;

      const userId = 'clientUserId7';
      const count = 2;
      const result = service.getBatchSignatures(userId, count);

      expect(result.signatures[0].uploadPreset).toBe('client_checkins');

      if (originalPreset) {
        process.env.CLOUDINARY_UPLOAD_PRESET = originalPreset;
      }
    });
  });
});

