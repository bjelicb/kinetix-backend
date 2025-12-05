import { Document, Types } from 'mongoose';
import { WorkoutDifficulty } from '../../common/enums/workout-difficulty.enum';
export type WeeklyPlanDocument = WeeklyPlan & Document;
export interface Exercise {
    name: string;
    sets: number;
    reps: number | string;
    restSeconds: number;
    notes?: string;
    videoUrl?: string;
}
export interface WorkoutDay {
    dayOfWeek: number;
    isRestDay: boolean;
    name: string;
    exercises: Exercise[];
    estimatedDuration: number;
    notes?: string;
}
export declare class WeeklyPlan {
    trainerId: Types.ObjectId;
    name: string;
    description?: string;
    difficulty: WorkoutDifficulty;
    workouts: WorkoutDay[];
    assignedClientIds: Types.ObjectId[];
    isTemplate: boolean;
}
export declare const WeeklyPlanSchema: import("mongoose").Schema<WeeklyPlan, import("mongoose").Model<WeeklyPlan, any, any, any, Document<unknown, any, WeeklyPlan, any, import("mongoose").DefaultSchemaOptions> & WeeklyPlan & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any, WeeklyPlan>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, WeeklyPlan, Document<unknown, {}, WeeklyPlan, {
    id: string;
}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WeeklyPlan & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    trainerId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, WeeklyPlan, Document<unknown, {}, WeeklyPlan, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WeeklyPlan & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, WeeklyPlan, Document<unknown, {}, WeeklyPlan, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WeeklyPlan & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string | undefined, WeeklyPlan, Document<unknown, {}, WeeklyPlan, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WeeklyPlan & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    difficulty?: import("mongoose").SchemaDefinitionProperty<WorkoutDifficulty, WeeklyPlan, Document<unknown, {}, WeeklyPlan, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WeeklyPlan & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    workouts?: import("mongoose").SchemaDefinitionProperty<WorkoutDay[], WeeklyPlan, Document<unknown, {}, WeeklyPlan, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WeeklyPlan & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    assignedClientIds?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId[], WeeklyPlan, Document<unknown, {}, WeeklyPlan, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WeeklyPlan & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isTemplate?: import("mongoose").SchemaDefinitionProperty<boolean, WeeklyPlan, Document<unknown, {}, WeeklyPlan, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WeeklyPlan & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, WeeklyPlan>;
