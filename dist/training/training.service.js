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
exports.TrainingService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const clients_service_1 = require("../clients/clients.service");
const workouts_service_1 = require("../workouts/workouts.service");
const checkins_service_1 = require("../checkins/checkins.service");
const workout_log_schema_1 = require("../workouts/schemas/workout-log.schema");
const checkin_schema_1 = require("../checkins/schemas/checkin.schema");
let TrainingService = class TrainingService {
    clientsService;
    workoutsService;
    checkInsService;
    workoutLogModel;
    checkInModel;
    constructor(clientsService, workoutsService, checkInsService, workoutLogModel, checkInModel) {
        this.clientsService = clientsService;
        this.workoutsService = workoutsService;
        this.checkInsService = checkInsService;
        this.workoutLogModel = workoutLogModel;
        this.checkInModel = checkInModel;
    }
    async syncBatch(clientId, syncBatchDto) {
        const clientProfile = await this.clientsService.getProfile(clientId);
        if (!clientProfile) {
            throw new common_1.NotFoundException('Client profile not found.');
        }
        const result = {
            processedLogs: 0,
            processedCheckIns: 0,
            errors: [],
        };
        if (syncBatchDto.newLogs && syncBatchDto.newLogs.length > 0) {
            const bulkOps = [];
            for (let i = 0; i < syncBatchDto.newLogs.length; i++) {
                const logDto = syncBatchDto.newLogs[i];
                try {
                    const workoutDate = new Date(logDto.workoutDate);
                    const weekWorkouts = await this.workoutsService.getWeekWorkouts(clientId, workoutDate);
                    const log = weekWorkouts.find((w) => new Date(w.workoutDate).toISOString().split('T')[0] ===
                        workoutDate.toISOString().split('T')[0]);
                    if (!log) {
                        result.errors.push({
                            type: 'LOG',
                            index: i,
                            reason: `Workout log not found for date ${logDto.workoutDate}. Please ensure plan is assigned.`,
                        });
                        continue;
                    }
                    const updateData = {
                        completedExercises: logDto.completedExercises?.map((ex) => ({
                            exerciseName: ex.exerciseName,
                            actualSets: Array.isArray(ex.actualSets) ? ex.actualSets.length : (ex.actualSets || 0),
                            actualReps: ex.actualReps || [],
                            weightUsed: Array.isArray(ex.weightUsed) ? ex.weightUsed[0] : ex.weightUsed,
                            notes: ex.notes,
                        })),
                        isCompleted: logDto.isCompleted ?? true,
                    };
                    if (logDto.completedAt) {
                        updateData.completedAt = new Date(logDto.completedAt);
                    }
                    if (logDto.difficultyRating !== undefined) {
                        updateData.difficultyRating = logDto.difficultyRating;
                    }
                    if (logDto.clientNotes !== undefined) {
                        updateData.clientNotes = logDto.clientNotes;
                    }
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: new mongoose_2.Types.ObjectId(log._id) },
                            update: { $set: updateData },
                        },
                    });
                }
                catch (error) {
                    result.errors.push({
                        type: 'LOG',
                        index: i,
                        reason: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            if (bulkOps.length > 0) {
                try {
                    await this.workoutLogModel.bulkWrite(bulkOps);
                    result.processedLogs = bulkOps.length;
                }
                catch (error) {
                    for (let i = 0; i < syncBatchDto.newLogs.length; i++) {
                        const logDto = syncBatchDto.newLogs[i];
                        try {
                            const workoutDate = new Date(logDto.workoutDate);
                            const weekWorkouts = await this.workoutsService.getWeekWorkouts(clientId, workoutDate);
                            const log = weekWorkouts.find((w) => new Date(w.workoutDate).toISOString().split('T')[0] ===
                                workoutDate.toISOString().split('T')[0]);
                            if (log) {
                                await this.workoutsService.updateWorkoutLog(log._id.toString(), {
                                    completedExercises: logDto.completedExercises?.map((ex) => ({
                                        exerciseName: ex.exerciseName,
                                        actualSets: Array.isArray(ex.actualSets) ? ex.actualSets.length : (ex.actualSets || 0),
                                        actualReps: ex.actualReps || [],
                                        weightUsed: Array.isArray(ex.weightUsed) ? ex.weightUsed[0] : ex.weightUsed,
                                        notes: ex.notes,
                                    })),
                                    isCompleted: logDto.isCompleted ?? true,
                                    completedAt: logDto.completedAt,
                                    difficultyRating: logDto.difficultyRating,
                                    clientNotes: logDto.clientNotes,
                                });
                                result.processedLogs++;
                            }
                        }
                        catch (error) {
                            result.errors.push({
                                type: 'LOG',
                                index: i,
                                reason: error instanceof Error ? error.message : 'Unknown error',
                            });
                        }
                    }
                }
            }
        }
        if (syncBatchDto.newCheckIns && syncBatchDto.newCheckIns.length > 0) {
            for (let i = 0; i < syncBatchDto.newCheckIns.length; i++) {
                const checkInDto = syncBatchDto.newCheckIns[i];
                try {
                    const checkInDate = new Date(checkInDto.checkinDate);
                    const existingCheckIns = await this.checkInsService.getCheckInsByDateRange(clientId, checkInDate, checkInDate);
                    const existingCheckIn = existingCheckIns.find((c) => c.checkinDate.toISOString().split('T')[0] ===
                        checkInDate.toISOString().split('T')[0]);
                    if (existingCheckIn) {
                        result.errors.push({
                            type: 'CHECKIN',
                            index: i,
                            reason: `Check-in already exists for date ${checkInDto.checkinDate}`,
                        });
                        continue;
                    }
                    await this.checkInsService.createCheckIn(clientId, {
                        workoutLogId: checkInDto.workoutLogId,
                        checkinDate: checkInDto.checkinDate,
                        photoUrl: checkInDto.photoUrl,
                        thumbnailUrl: checkInDto.thumbnailUrl,
                        gpsCoordinates: checkInDto.gpsCoordinates,
                        clientNotes: checkInDto.clientNotes,
                    });
                    result.processedCheckIns++;
                }
                catch (error) {
                    result.errors.push({
                        type: 'CHECKIN',
                        index: i,
                        reason: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        }
        return result;
    }
};
exports.TrainingService = TrainingService;
exports.TrainingService = TrainingService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, mongoose_1.InjectModel)(workout_log_schema_1.WorkoutLog.name)),
    __param(4, (0, mongoose_1.InjectModel)(checkin_schema_1.CheckIn.name)),
    __metadata("design:paramtypes", [clients_service_1.ClientsService,
        workouts_service_1.WorkoutsService,
        checkins_service_1.CheckInsService,
        mongoose_2.Model,
        mongoose_2.Model])
], TrainingService);
//# sourceMappingURL=training.service.js.map