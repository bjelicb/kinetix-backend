import { Injectable } from '@nestjs/common';
import { cloudinary } from './config/cloudinary.config';
import { UploadSignatureDto } from './dto/upload-signature.dto';

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
}

