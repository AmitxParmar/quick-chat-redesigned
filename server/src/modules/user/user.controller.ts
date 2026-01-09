
import { Response, NextFunction } from 'express';
import UserService from './user.service';
import { AuthRequest } from '@/types/auth.type';

class UserController {
    private userService = new UserService();

    /**
     * Get all users
     */
    public getAllUsers = async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const search = req.query.search as string | undefined;
            const userId = req.user!.id;
            const users = await this.userService.getAllUsers(search, userId);
            res.status(200).json({
                data: users,
                message: 'Users retrieved successfully',
            });
        } catch (error) {
            next(error);
        }
    };
}

export default UserController;
