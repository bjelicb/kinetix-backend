import { Injectable } from '@nestjs/common';
import { cloudinary } from './config/cloudinary.config';
import { UploadSignatureDto } from './dto/upload-signature.dto';
import { AppLogger } from '../common/utils/logger.utils';

@Injectable()
export class MediaService {
  getUploadSignature(userId: string): UploadSignatureDto {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = `checkins/client_${userId}`;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'client_checkins';

    // Generate signature
    const params = {
      timestamp,
      folder,
      upload_preset: uploadPreset,
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET || '',
    );

    return {
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      uploadPreset,
      folder,
    };
  }

  getBatchSignatures(userId: string, count: number): { signatures: UploadSignatureDto[] } {
    AppLogger.logStart('MEDIA_BATCH', {
      userId,
      count,
    });

    const signatures: UploadSignatureDto[] = [];
    const timestamp = Math.round(new Date().getTime() / 1000);

    AppLogger.logOperation('MEDIA_BATCH_RATE_LIMIT', {
      userId,
      count,
      maxAllowed: 10,
    }, 'debug');

    for (let i = 0; i < count; i++) {
      const folder = `checkins/${userId}/${timestamp}_${i}`;
      const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'client_checkins';

      const params = {
        timestamp,
        folder,
        upload_preset: uploadPreset,
      };

      const signature = cloudinary.utils.api_sign_request(
        params,
        process.env.CLOUDINARY_API_SECRET || '',
      );

      AppLogger.logOperation('MEDIA_BATCH_SIGNATURE_GEN', {
        userId,
        index: i,
        folder,
        timestamp,
      }, 'debug');

      signatures.push({
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        uploadPreset,
        folder,
      });
    }

    AppLogger.logComplete('MEDIA_BATCH', {
      userId,
      totalCount: signatures.length,
    });

    return { signatures };
  }
}

