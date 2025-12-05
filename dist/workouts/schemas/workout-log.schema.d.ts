import { Document, Types } from 'mongoose';
export type WorkoutLogDocument = WorkoutLog & Document;
export interface CompletedExercise {
    exerciseName: string;
    actualSets: number;
    actualReps: number[];
    weightUsed?: number;
    notes?: string;
}
export declare class WorkoutLog {
    clientId: Types.ObjectId;
    trainerId: Types.ObjectId;
    weeklyPlanId: Types.ObjectId;
    workoutDate: Date;
    weekNumber?: number;
    dayOfWeek: number;
    completedExercises: CompletedExercise[];
    isCompleted: boolean;
    isMissed: boolean;
    completedAt?: Date;
    difficultyRating?: number;
    clientNotes?: string;
}
export declare const WorkoutLogSchema: import("mongoose").Schema<WorkoutLog, import("mongoose").Model<WorkoutLog, any, any, any, Document<unknown, any, WorkoutLog, any, import("mongoose").DefaultSchemaOptions> & WorkoutLog & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any, WorkoutLog>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, WorkoutLog, Document<unknown, {}, WorkoutLog, {
    id: string;
}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    clientId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    trainerId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    weeklyPlanId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    workoutDate?: import("mongoose").SchemaDefinitionProperty<Date, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    weekNumber?: import("mongoose").SchemaDefinitionProperty<number | undefined, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    dayOfWeek?: import("mongoose").SchemaDefinitionProperty<number, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    completedExercises?: import("mongoose").SchemaDefinitionProperty<CompletedExercise[], WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isCompleted?: import("mongoose").SchemaDefinitionProperty<boolean, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isMissed?: import("mongoose").SchemaDefinitionProperty<boolean, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    completedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    difficultyRating?: import("mongoose").SchemaDefinitionProperty<number | undefined, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    clientNotes?: import("mongoose").SchemaDefinitionProperty<string | undefined, WorkoutLog, Document<unknown, {}, WorkoutLog, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<WorkoutLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, WorkoutLog>;
