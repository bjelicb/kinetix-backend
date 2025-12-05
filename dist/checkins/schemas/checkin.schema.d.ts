import { Document, Types } from 'mongoose';
import { VerificationStatus } from '../../common/enums/verification-status.enum';
export type CheckInDocument = CheckIn & Document;
declare class GpsCoordinates {
    latitude: number;
    longitude: number;
    accuracy: number;
}
export declare class CheckIn {
    clientId: Types.ObjectId;
    trainerId: Types.ObjectId;
    workoutLogId: Types.ObjectId;
    checkinDate: Date;
    photoUrl: string;
    thumbnailUrl: string;
    gpsCoordinates: GpsCoordinates;
    verificationStatus: VerificationStatus;
    verifiedBy: Types.ObjectId;
    verifiedAt: Date;
    rejectionReason: string;
    aiConfidenceScore: number;
    detectedActivities: string[];
    isGymLocation: boolean;
    clientNotes: string;
}
export declare const CheckInSchema: import("mongoose").Schema<CheckIn, import("mongoose").Model<CheckIn, any, any, any, Document<unknown, any, CheckIn, any, import("mongoose").DefaultSchemaOptions> & CheckIn & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any, CheckIn>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, CheckIn, Document<unknown, {}, CheckIn, {
    id: string;
}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    clientId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    trainerId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    workoutLogId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    checkinDate?: import("mongoose").SchemaDefinitionProperty<Date, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    photoUrl?: import("mongoose").SchemaDefinitionProperty<string, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    thumbnailUrl?: import("mongoose").SchemaDefinitionProperty<string, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    gpsCoordinates?: import("mongoose").SchemaDefinitionProperty<GpsCoordinates, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    verificationStatus?: import("mongoose").SchemaDefinitionProperty<VerificationStatus, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    verifiedBy?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    verifiedAt?: import("mongoose").SchemaDefinitionProperty<Date, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    rejectionReason?: import("mongoose").SchemaDefinitionProperty<string, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    aiConfidenceScore?: import("mongoose").SchemaDefinitionProperty<number, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    detectedActivities?: import("mongoose").SchemaDefinitionProperty<string[], CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isGymLocation?: import("mongoose").SchemaDefinitionProperty<boolean, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    clientNotes?: import("mongoose").SchemaDefinitionProperty<string, CheckIn, Document<unknown, {}, CheckIn, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<CheckIn & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, CheckIn>;
export {};
