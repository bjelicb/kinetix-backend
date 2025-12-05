"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const cloudinary_config_1 = require("./config/cloudinary.config");
let MediaService = class MediaService {
    getUploadSignature(userId) {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = `checkins/client_${userId}`;
        const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'client_checkins';
        const params = {
            timestamp,
            folder,
            upload_preset: uploadPreset,
        };
        const signature = cloudinary_config_1.cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET || '');
        return {
            signature,
            timestamp,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
            apiKey: process.env.CLOUDINARY_API_KEY || '',
            uploadPreset,
            folder,
        };
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)()
], MediaService);
//# sourceMappingURL=media.service.js.map