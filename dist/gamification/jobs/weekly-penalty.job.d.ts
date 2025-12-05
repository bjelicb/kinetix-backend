import { Model } from 'mongoose';
import { PenaltyRecordDocument } from '../schemas/penalty-record.schema';
import { ClientProfileDocument } from '../../clients/schemas/client-profile.schema';
import { WorkoutLogDocument } from '../../workouts/schemas/workout-log.schema';
export declare class WeeklyPenaltyJob {
    private penaltyRecordModel;
    private clientProfileModel;
    private workoutLogModel;
    constructor(penaltyRecordModel: Model<PenaltyRecordDocument>, clientProfileModel: Model<ClientProfileDocument>, workoutLogModel: Model<WorkoutLogDocument>);
    calculateWeeklyPenalties(): Promise<void>;
}
