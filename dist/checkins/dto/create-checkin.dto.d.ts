declare class GpsCoordinatesDto {
    latitude: number;
    longitude: number;
    accuracy?: number;
}
export declare class CreateCheckInDto {
    workoutLogId?: string;
    checkinDate: string;
    photoUrl: string;
    thumbnailUrl?: string;
    gpsCoordinates: GpsCoordinatesDto;
    aiConfidenceScore?: number;
    detectedActivities?: string[];
    clientNotes?: string;
}
export {};
