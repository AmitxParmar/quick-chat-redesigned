
import userRepository from './user.repository';
import { User } from '@prisma/client';

export default class UserService {
    /**
     * Get all users
     */
    public async getAllUsers(search?: string, userId?: User['id']): Promise<Omit<User, 'password'>[]> {
        return userRepository.findAll(search, userId);
    }
}
