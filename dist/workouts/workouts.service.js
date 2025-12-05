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
exports.WorkoutsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const workout_log_schema_1 = require("./schemas/workout-log.schema");
const clients_service_1 = require("../clients/clients.service");
let WorkoutsService = class WorkoutsService {
    workoutLogModel;
    clientsService;
    constructor(workoutLogModel, clientsService) {
        this.workoutLogModel = workoutLogModel;
        this.clientsService = clientsService;
    }
    async generateWeeklyLogs(client, plan, startDate) {
        try {
            const logs = [];
            const weekStartDate = new Date(startDate);
            weekStartDate.setHours(0, 0, 0, 0);
            const planWorkouts = plan.workouts || plan.workouts;
            if (!planWorkouts || !Array.isArray(planWorkouts)) {
                throw new Error(`Plan does not have valid workouts array. Plan ID: ${plan._id}`);
            }
            const clientProfileId = client._id || client.id;
            if (!clientProfileId) {
                throw new Error('Client profile ID is missing');
            }
            let trainerProfileId = client.trainerId;
            if (!trainerProfileId) {
                throw new Error(`Client does not have a trainer assigned. Client ID: ${clientProfileId}`);
            }
            let trainerProfileIdString;
            if (trainerProfileId?._id) {
                trainerProfileIdString = trainerProfileId._id.toString();
            }
            else if (typeof trainerProfileId === 'string') {
                trainerProfileIdString = trainerProfileId;
            }
            else if (trainerProfileId instanceof mongoose_2.Types.ObjectId) {
                trainerProfileIdString = trainerProfileId.toString();
            }
            else {
                trainerProfileIdString = String(trainerProfileId);
            }
            if (!mongoose_2.Types.ObjectId.isValid(trainerProfileIdString)) {
                throw new Error(`Invalid trainer ID format: ${trainerProfileIdString}`);
            }
            const planId = plan._id || plan.id;
            if (!planId) {
                throw new Error('Plan ID is missing');
            }
            for (let day = 0; day < 7; day++) {
                const workoutDate = new Date(weekStartDate);
                workoutDate.setDate(workoutDate.getDate() + day);
                workoutDate.setHours(0, 0, 0, 0);
                const workoutDateEnd = new Date(workoutDate);
                workoutDateEnd.setHours(23, 59, 59, 999);
                const existingLog = await this.workoutLogModel.findOne({
                    clientId: new mongoose_2.Types.ObjectId(clientProfileId),
                    workoutDate: {
                        $gte: workoutDate,
                        $lt: workoutDateEnd,
                    },
                }).exec();
                if (existingLog) {
                    continue;
                }
                const dayOfWeek = workoutDate.getDay() === 0 ? 7 : workoutDate.getDay();
                const planWorkout = planWorkouts.find((w) => w.dayOfWeek === dayOfWeek) || null;
                let completedExercises = [];
                if (planWorkout && planWorkout.exercises && Array.isArray(planWorkout.exercises) && planWorkout.exercises.length > 0) {
                    completedExercises = planWorkout.exercises.map((ex) => ({
                        exerciseName: ex.name || ex.exerciseName || 'Unknown',
                        actualSets: ex.sets || 0,
                        actualReps: [],
                        weightUsed: undefined,
                        notes: undefined,
                    }));
                }
                const log = new this.workoutLogModel({
                    clientId: new mongoose_2.Types.ObjectId(clientProfileId),
                    trainerId: new mongoose_2.Types.ObjectId(trainerProfileIdString),
                    weeklyPlanId: new mongoose_2.Types.ObjectId(planId),
                    workoutDate,
                    weekNumber: 1,
                    dayOfWeek,
                    isCompleted: false,
                    isMissed: planWorkout?.isRestDay === true ? false : false,
                    completedExercises,
                });
                logs.push(log);
            }
            if (logs.length > 0) {
                try {
                    return await this.workoutLogModel.insertMany(logs, { ordered: false });
                }
                catch (error) {
                    if (error.code === 11000) {
                        if (error.result && error.result.insertedCount > 0) {
                            const insertedIds = Object.values(error.result.insertedIds || {});
                            if (insertedIds.length > 0) {
                                const objectIds = insertedIds.map(id => id instanceof mongoose_2.Types.ObjectId ? id : new mongoose_2.Types.ObjectId(id));
                                return await this.workoutLogModel.find({
                                    _id: { $in: objectIds },
                                }).exec();
                            }
                        }
                        return [];
                    }
                    throw error;
                }
            }
            return [];
        }
        catch (error) {
            console.error('Error in generateWeeklyLogs:', error);
            throw error;
        }
    }
    async logWorkout(userId, dto) {
        const client = await this.clientsService.getProfile(userId);
        const clientProfileId = client._id;
        const workoutDate = new Date(dto.workoutDate);
        const existingLog = await this.workoutLogModel.findOne({
            clientId: new mongoose_2.Types.ObjectId(clientProfileId),
            workoutDate,
        }).exec();
        if (existingLog) {
            existingLog.completedExercises = dto.completedExercises || [];
            existingLog.isCompleted = dto.isCompleted ?? true;
            existingLog.completedAt = dto.completedAt
                ? new Date(dto.completedAt)
                : new Date();
            existingLog.difficultyRating = dto.difficultyRating;
            existingLog.clientNotes = dto.clientNotes;
            return existingLog.save();
        }
        const trainerId = client.trainerId;
        const trainerIdString = trainerId?._id
            ? trainerId._id.toString()
            : trainerId.toString();
        const log = new this.workoutLogModel({
            clientId: new mongoose_2.Types.ObjectId(clientProfileId),
            trainerId: new mongoose_2.Types.ObjectId(trainerIdString),
            weeklyPlanId: new mongoose_2.Types.ObjectId(dto.weeklyPlanId),
            workoutDate,
            dayOfWeek: dto.dayOfWeek,
            completedExercises: dto.completedExercises || [],
            isCompleted: dto.isCompleted ?? true,
            completedAt: dto.completedAt ? new Date(dto.completedAt) : new Date(),
            difficultyRating: dto.difficultyRating,
            clientNotes: dto.clientNotes,
        });
        return log.save();
    }
    async updateWorkoutLog(logId, dto) {
        const updateData = {};
        if (dto.completedExercises) {
            updateData.completedExercises = dto.completedExercises;
        }
        if (dto.isCompleted !== undefined) {
            updateData.isCompleted = dto.isCompleted;
        }
        if (dto.completedAt) {
            updateData.completedAt = new Date(dto.completedAt);
        }
        if (dto.difficultyRating) {
            updateData.difficultyRating = dto.difficultyRating;
        }
        if (dto.clientNotes !== undefined) {
            updateData.clientNotes = dto.clientNotes;
        }
        const log = await this.workoutLogModel
            .findByIdAndUpdate(logId, { $set: updateData }, { new: true })
            .exec();
        if (!log) {
            throw new common_1.NotFoundException('Workout log not found');
        }
        return log;
    }
    async getTodayWorkout(userId) {
        const client = await this.clientsService.getProfile(userId);
        const clientProfileId = client._id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.workoutLogModel
            .findOne({
            clientId: new mongoose_2.Types.ObjectId(clientProfileId),
            workoutDate: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            },
        })
            .select('clientId trainerId weeklyPlanId workoutDate weekNumber dayOfWeek completedExercises isCompleted isMissed completedAt difficultyRating clientNotes')
            .populate('weeklyPlanId', 'name workouts')
            .lean()
            .exec();
    }
    async getWorkoutById(logId) {
        const log = await this.workoutLogModel
            .findById(logId)
            .populate('weeklyPlanId', 'name workouts')
            .exec();
        if (!log) {
            throw new common_1.NotFoundException('Workout log not found');
        }
        return log;
    }
    async getWeekWorkouts(userId, date) {
        const client = await this.clientsService.getProfile(userId);
        const clientProfileId = client._id;
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return this.workoutLogModel
            .find({
            clientId: new mongoose_2.Types.ObjectId(clientProfileId),
            workoutDate: {
                $gte: weekStart,
                $lt: weekEnd,
            },
        })
            .select('clientId trainerId weeklyPlanId workoutDate weekNumber dayOfWeek completedExercises isCompleted isMissed completedAt difficultyRating clientNotes')
            .populate('weeklyPlanId', 'name')
            .sort({ workoutDate: 1 })
            .lean()
            .exec();
    }
    async getWorkoutHistory(clientId) {
        return this.workoutLogModel
            .find({
            clientId: new mongoose_2.Types.ObjectId(clientId),
            isCompleted: true,
        })
            .select('clientId trainerId weeklyPlanId workoutDate weekNumber dayOfWeek completedExercises isCompleted isMissed completedAt difficultyRating clientNotes')
            .populate('weeklyPlanId', 'name')
            .sort({ workoutDate: -1 })
            .lean()
            .exec();
    }
    async markMissedWorkouts() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const result = await this.workoutLogModel.updateMany({
            workoutDate: { $lt: today },
            isCompleted: false,
            isMissed: false,
        }, {
            $set: { isMissed: true },
        }).exec();
        return result.modifiedCount;
    }
};
exports.WorkoutsService = WorkoutsService;
exports.WorkoutsService = WorkoutsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(workout_log_schema_1.WorkoutLog.name)),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => clients_service_1.ClientsService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        clients_service_1.ClientsService])
], WorkoutsService);
//# sourceMappingURL=workouts.service.js.map