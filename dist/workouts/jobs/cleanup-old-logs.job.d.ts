import { Model } from 'mongoose';
import { WorkoutLogDocument } from '../schemas/workout-log.schema';
import { CheckInDocument } from '../../checkins/schemas/checkin.schema';
export declare class CleanupOldLogs {
    private workoutLogModel;
    private checkInModel;
    constructor(workoutLogModel: Model<WorkoutLogDocument>, checkInModel: Model<CheckInDocument>);
    cleanupOldLogs(): Promise<void>;
}
