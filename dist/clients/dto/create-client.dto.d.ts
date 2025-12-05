import { FitnessGoal, ActivityLevel } from '../schemas/client-profile.schema';
export declare class CreateClientDto {
    trainerId?: string;
    age?: number;
    weight?: number;
    height?: number;
    fitnessGoal?: FitnessGoal;
    activityLevel?: ActivityLevel;
    medicalConditions?: string;
    notes?: string;
}
