import { Document, Types } from 'mongoose';
export type ClientProfileDocument = ClientProfile & Document;
export declare enum FitnessGoal {
    WEIGHT_LOSS = "WEIGHT_LOSS",
    MUSCLE_GAIN = "MUSCLE_GAIN",
    ENDURANCE = "ENDURANCE",
    GENERAL_FITNESS = "GENERAL_FITNESS"
}
export declare enum ActivityLevel {
    SEDENTARY = "SEDENTARY",
    LIGHT = "LIGHT",
    MODERATE = "MODERATE",
    VERY_ACTIVE = "VERY_ACTIVE"
}
export declare class ClientProfile {
    userId: Types.ObjectId;
    trainerId: Types.ObjectId;
    age?: number;
    weight?: number;
    height?: number;
    fitnessGoal?: FitnessGoal;
    activityLevel?: ActivityLevel;
    currentPlanId?: Types.ObjectId;
    planStartDate?: Date;
    planEndDate?: Date;
    isPenaltyMode: boolean;
    consecutiveMissedWorkouts: number;
    totalWorkoutsCompleted: number;
    currentStreak: number;
    medicalConditions?: string;
    notes?: string;
}
export declare const ClientProfileSchema: import("mongoose").Schema<ClientProfile, import("mongoose").Model<ClientProfile, any, any, any, Document<unknown, any, ClientProfile, any, import("mongoose").DefaultSchemaOptions> & ClientProfile & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any, ClientProfile>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ClientProfile, Document<unknown, {}, ClientProfile, {
    id: string;
}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    trainerId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    age?: import("mongoose").SchemaDefinitionProperty<number | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    weight?: import("mongoose").SchemaDefinitionProperty<number | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    height?: import("mongoose").SchemaDefinitionProperty<number | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fitnessGoal?: import("mongoose").SchemaDefinitionProperty<FitnessGoal | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    activityLevel?: import("mongoose").SchemaDefinitionProperty<ActivityLevel | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    currentPlanId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    planStartDate?: import("mongoose").SchemaDefinitionProperty<Date | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    planEndDate?: import("mongoose").SchemaDefinitionProperty<Date | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isPenaltyMode?: import("mongoose").SchemaDefinitionProperty<boolean, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    consecutiveMissedWorkouts?: import("mongoose").SchemaDefinitionProperty<number, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    totalWorkoutsCompleted?: import("mongoose").SchemaDefinitionProperty<number, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    currentStreak?: import("mongoose").SchemaDefinitionProperty<number, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    medicalConditions?: import("mongoose").SchemaDefinitionProperty<string | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    notes?: import("mongoose").SchemaDefinitionProperty<string | undefined, ClientProfile, Document<unknown, {}, ClientProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<ClientProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, ClientProfile>;
