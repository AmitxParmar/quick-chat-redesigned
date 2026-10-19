
import userRepository from './user.repository';
import { User } from '@prisma/client';
import { type PublicUser } from '@/types/user.type';

export default class UserService {
    /**
     * Get all users
     */
    public async getAllUsers(search?: string, userId?: User['id']): Promise<PublicUser[]> {
        return userRepository.findAll(search, userId);
    }
}
