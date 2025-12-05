import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersService {
    private userModel;
    constructor(userModel: Model<UserDocument>);
    create(createUserDto: CreateUserDto): Promise<User>;
    findOneByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    findOne(id: string): Promise<User | null>;
}
