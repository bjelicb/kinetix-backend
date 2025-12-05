"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckInsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const checkin_schema_1 = require("./schemas/checkin.schema");
const clients_service_1 = require("../clients/clients.service");
const trainers_service_1 = require("../trainers/trainers.service");
const verification_status_enum_1 = require("../common/enums/verification-status.enum");
let CheckInsService = class CheckInsService {
    checkInModel;
    clientsService;
    trainersService;
    constructor(checkInModel, clientsService, trainersService) {
        this.checkInModel = checkInModel;
        this.clientsService = clientsService;
        this.trainersService = trainersService;
    }
    async createCheckIn(clientId, createCheckInDto) {
        const clientProfile = await this.clientsService.getProfile(clientId);
        if (!clientProfile) {
            throw new common_1.NotFoundException('Client profile not found.');
        }
        const checkIn = new this.checkInModel({
            clientId: clientProfile._id || clientProfile.userId,
            trainerId: clientProfile.trainerId,
            workoutLogId: createCheckInDto.workoutLogId ? new mongoose_2.Types.ObjectId(createCheckInDto.workoutLogId) : undefined,
            checkinDate: new Date(createCheckInDto.checkinDate),
            photoUrl: createCheckInDto.photoUrl,
            thumbnailUrl: createCheckInDto.thumbnailUrl,
            gpsCoordinates: createCheckInDto.gpsCoordinates,
            aiConfidenceScore: createCheckInDto.aiConfidenceScore,
            detectedActivities: createCheckInDto.detectedActivities,
            clientNotes: createCheckInDto.clientNotes,
            verificationStatus: verification_status_enum_1.VerificationStatus.PENDING,
        });
        return checkIn.save();
    }
    async getCheckInsByClient(clientId) {
        const clientProfile = await this.clientsService.getProfile(clientId);
        if (!clientProfile) {
            throw new common_1.NotFoundException('Client profile not found.');
        }
        return this.checkInModel
            .find({ clientId: clientProfile._id || clientProfile.userId })
            .select('clientId trainerId workoutLogId checkinDate photoUrl thumbnailUrl gpsCoordinates verificationStatus verifiedBy verifiedAt rejectionReason aiConfidenceScore detectedActivities isGymLocation clientNotes createdAt updatedAt')
            .sort({ checkinDate: -1 })
            .lean()
            .exec();
    }
    async getCheckInById(checkInId) {
        if (!mongoose_2.Types.ObjectId.isValid(checkInId)) {
            throw new common_1.NotFoundException('Check-in not found');
        }
        const checkIn = await this.checkInModel.findById(checkInId).exec();
        if (!checkIn) {
            throw new common_1.NotFoundException('Check-in not found');
        }
        return checkIn;
    }
    async verifyCheckIn(checkInId, trainerUserId, verifyCheckInDto) {
        const checkIn = await this.checkInModel.findById(checkInId).exec();
        if (!checkIn) {
            throw new common_1.NotFoundException(`Check-in with ID ${checkInId} not found.`);
        }
        const trainerProfile = await this.trainersService.getProfile(trainerUserId);
        const trainerProfileId = trainerProfile._id.toString();
        if (checkIn.trainerId.toString() !== trainerProfileId) {
            throw new common_1.ForbiddenException('You are not authorized to verify this check-in.');
        }
        checkIn.verificationStatus = verifyCheckInDto.verificationStatus;
        checkIn.verifiedBy = new mongoose_2.Types.ObjectId(trainerUserId);
        checkIn.verifiedAt = new Date();
        if (verifyCheckInDto.rejectionReason) {
            checkIn.rejectionReason = verifyCheckInDto.rejectionReason;
        }
        return checkIn.save();
    }
    async getPendingCheckIns(trainerId) {
        return this.checkInModel
            .find({
            trainerId: new mongoose_2.Types.ObjectId(trainerId),
            verificationStatus: verification_status_enum_1.VerificationStatus.PENDING,
        })
            .select('clientId trainerId workoutLogId checkinDate photoUrl thumbnailUrl gpsCoordinates verificationStatus verifiedBy verifiedAt rejectionReason aiConfidenceScore detectedActivities isGymLocation clientNotes createdAt updatedAt')
            .populate('clientId', 'userId')
            .sort({ checkinDate: -1 })
            .lean()
            .exec();
    }
    async getCheckInsByDateRange(clientId, startDate, endDate) {
        const clientProfile = await this.clientsService.getProfile(clientId);
        if (!clientProfile) {
            throw new common_1.NotFoundException('Client profile not found.');
        }
        return this.checkInModel
            .find({
            clientId: clientProfile._id || clientProfile.userId,
            checkinDate: { $gte: startDate, $lte: endDate },
        })
            .select('clientId trainerId workoutLogId checkinDate photoUrl thumbnailUrl gpsCoordinates verificationStatus verifiedBy verifiedAt rejectionReason aiConfidenceScore detectedActivities isGymLocation clientNotes createdAt updatedAt')
            .sort({ checkinDate: -1 })
            .lean()
            .exec();
    }
    async deleteCheckIn(checkInId, clientId) {
        const checkIn = await this.checkInModel.findById(checkInId).exec();
        if (!checkIn) {
            throw new common_1.NotFoundException('Check-in not found');
        }
        const clientProfile = await this.clientsService.getProfile(clientId);
        const clientProfileId = clientProfile._id || clientProfile.userId;
        if (checkIn.clientId.toString() !== clientProfileId.toString()) {
            throw new common_1.ForbiddenException('You can only delete your own check-ins');
        }
        await this.checkInModel.findByIdAndDelete(checkInId).exec();
    }
};
exports.CheckInsService = CheckInsService;
exports.CheckInsService = CheckInsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(checkin_schema_1.CheckIn.name)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => trainers_service_1.TrainersService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        clients_service_1.ClientsService,
        trainers_service_1.TrainersService])
], CheckInsService);
//# sourceMappingURL=checkins.service.js.map