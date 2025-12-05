import { MediaService } from './media.service';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
export declare class MediaController {
    private mediaService;
    constructor(mediaService: MediaService);
    getUploadSignature(user: JwtPayload): Promise<import("./dto/upload-signature.dto").UploadSignatureDto>;
}
