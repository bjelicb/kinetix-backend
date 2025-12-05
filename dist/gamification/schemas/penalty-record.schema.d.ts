import { Document, Types } from 'mongoose';
export type PenaltyRecordDocument = PenaltyRecord & Document;
export declare enum PenaltyType {
    WARNING = "WARNING",
    PENALTY_MODE = "PENALTY_MODE",
    NONE = "NONE"
}
export declare class PenaltyRecord {
    clientId: Types.ObjectId;
    trainerId: Types.ObjectId;
    weekStartDate: Date;
    weekEndDate: Date;
    totalMissedWorkouts: number;
    totalScheduledWorkouts: number;
    completionRate: number;
    isPenaltyApplied: boolean;
    penaltyType: PenaltyType;
    trainerNotes: string;
}
export declare const PenaltyRecordSchema: import("mongoose").Schema<PenaltyRecord, import("mongoose").Model<PenaltyRecord, any, any, any, Document<unknown, any, PenaltyRecord, any, import("mongoose").DefaultSchemaOptions> & PenaltyRecord & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any, PenaltyRecord>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
    id: string;
}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    clientId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    trainerId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    weekStartDate?: import("mongoose").SchemaDefinitionProperty<Date, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    weekEndDate?: import("mongoose").SchemaDefinitionProperty<Date, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    totalMissedWorkouts?: import("mongoose").SchemaDefinitionProperty<number, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    totalScheduledWorkouts?: import("mongoose").SchemaDefinitionProperty<number, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    completionRate?: import("mongoose").SchemaDefinitionProperty<number, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isPenaltyApplied?: import("mongoose").SchemaDefinitionProperty<boolean, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    penaltyType?: import("mongoose").SchemaDefinitionProperty<PenaltyType, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    trainerNotes?: import("mongoose").SchemaDefinitionProperty<string, PenaltyRecord, Document<unknown, {}, PenaltyRecord, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<PenaltyRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, PenaltyRecord>;
