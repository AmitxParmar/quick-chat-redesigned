import { jest } from '@jest/globals';
import { type Task } from '@prisma/client';

// 1. Define mock objects
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
};

const mockEnvironment = {
    isDev: jest.fn(() => false),
    env: 'TEST',
};

const mockEmit = jest.fn();
const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
const mockOn = jest.fn();
const mockIo = {
    to: mockTo,
    emit: mockEmit,
    on: mockOn,
    use: jest.fn(),
};

// 2. Mock dependencies using jest.mock()
// Note: These will be hoisted to the top
jest.mock('@/lib/logger', () => ({
    __esModule: true,
    default: mockLogger,
}));

jest.mock('@/lib/environment', () => ({
    __esModule: true,
    default: mockEnvironment,
}));

jest.mock('@/lib/jwt', () => ({
    __esModule: true,
    default: {
        verifyAccessToken: jest.fn(),
    },
}));

jest.mock('@/modules/auth/auth.repository', () => ({
    __esModule: true,
    default: {
        findUserById: jest.fn(),
    },
}));

jest.mock('socket.io', () => {
    return {
        Server: jest.fn(() => mockIo),
    };
});

// 3. Import the service under test
import SocketService from '@/lib/socket';

describe('[Unit] - SocketService', () => {
    const mockTask: Task = {
        id: 'task-123',
        title: 'Test Task',
        description: 'Test Description',
        status: 'TODO',
        priority: 'LOW',
        dueDate: new Date(),
        creatorId: 'user-1',
        assignedToId: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Manually inject the mock IO instance into the service
        // because verify/initializing it via http server is complex in unit test
        (SocketService as unknown as any).io = mockIo;
    });

    describe('notifyTaskAssigned', () => {
        it('should emit notification:assigned event to the specific user room', () => {
            const userId = 'user-2';
            const taskTitle = 'Test Task';
            const taskId = 'task-123';
            const payload = {
                taskId: 'task-123',
                task: mockTask
            }

            SocketService.notifyTaskAssigned(userId, payload);

            expect(mockTo).toHaveBeenCalledWith(`user:${userId}`);
            expect(mockEmit).toHaveBeenCalledWith('task:assigned', payload);
        });
    });

    describe('emitTaskCreated', () => {
        it('should emit task:created event globally', () => {
            const payload = { taskId: mockTask.id, task: mockTask };
            SocketService.emitTaskCreated(payload);

            expect(mockEmit).toHaveBeenCalledWith('task:created', payload);
        });
    });

    describe('emitTaskUpdated', () => {
        it('should emit task:updated event globally', () => {
            const payload = { taskId: mockTask.id, task: mockTask };
            SocketService.emitTaskUpdated(payload);

            expect(mockEmit).toHaveBeenCalledWith('task:updated', payload);
        });
    });

    describe('emitTaskDeleted', () => {
        it('should emit task:deleted event globally', () => {
            const taskId = 'task-123';
            SocketService.emitTaskDeleted(taskId);

            expect(mockEmit).toHaveBeenCalledWith('task:deleted', { taskId });
        });
    });
});
