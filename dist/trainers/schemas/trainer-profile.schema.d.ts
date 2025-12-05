import { Document, Types } from 'mongoose';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
export type TrainerProfileDocument = TrainerProfile & Document;
export declare class TrainerProfile {
    userId: Types.ObjectId;
    isActive: boolean;
    subscriptionStatus: SubscriptionStatus;
    subscriptionTier: string;
    subscriptionExpiresAt: Date;
    lastPaymentDate?: Date;
    businessName?: string;
    bio?: string;
    certifications: string[];
    specializations: string[];
    yearsExperience?: number;
    clientIds: Types.ObjectId[];
    maxClients: number;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
}
export declare const TrainerProfileSchema: import("mongoose").Schema<TrainerProfile, import("mongoose").Model<TrainerProfile, any, any, any, Document<unknown, any, TrainerProfile, any, import("mongoose").DefaultSchemaOptions> & TrainerProfile & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any, TrainerProfile>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, TrainerProfile, Document<unknown, {}, TrainerProfile, {
    id: string;
}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isActive?: import("mongoose").SchemaDefinitionProperty<boolean, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    subscriptionStatus?: import("mongoose").SchemaDefinitionProperty<SubscriptionStatus, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    subscriptionTier?: import("mongoose").SchemaDefinitionProperty<string, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    subscriptionExpiresAt?: import("mongoose").SchemaDefinitionProperty<Date, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    lastPaymentDate?: import("mongoose").SchemaDefinitionProperty<Date | undefined, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    businessName?: import("mongoose").SchemaDefinitionProperty<string | undefined, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    bio?: import("mongoose").SchemaDefinitionProperty<string | undefined, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    certifications?: import("mongoose").SchemaDefinitionProperty<string[], TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    specializations?: import("mongoose").SchemaDefinitionProperty<string[], TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    yearsExperience?: import("mongoose").SchemaDefinitionProperty<number | undefined, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    clientIds?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId[], TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    maxClients?: import("mongoose").SchemaDefinitionProperty<number, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    stripeCustomerId?: import("mongoose").SchemaDefinitionProperty<string | undefined, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    stripeSubscriptionId?: import("mongoose").SchemaDefinitionProperty<string | undefined, TrainerProfile, Document<unknown, {}, TrainerProfile, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<TrainerProfile & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, TrainerProfile>;
