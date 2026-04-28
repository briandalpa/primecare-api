jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn(
    (headers: Record<string, string | string[] | undefined>) => headers,
  ),
  toNodeHandler: jest.fn(() => (_req: any, res: any) => res.json({ ok: true })),
}));

jest.mock('@/application/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn() },
  },
}));

jest.mock('@/utils/auth', () => ({
  auth: {
    api: { getSession: jest.fn() },
  },
}));

import request from 'supertest';
import { app } from '@/application/app';
import { prisma } from '@/application/database';
import { auth } from '@/utils/auth';
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service';

describe('Worker Notification Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockWorkerAuth = (overrides: Partial<any> = {}) => {
    const mockUser = { id: 'user-worker', email: 'worker@example.com' };
    const mockStaff = {
      id: 'staff-worker',
      userId: 'user-worker',
      role: 'WORKER',
      isActive: true,
      outletId: 'outlet-1',
      workerType: 'WASHING',
      ...overrides,
    };

    (auth.api.getSession as jest.Mock).mockResolvedValue({
      user: mockUser,
      session: { id: 'session-1', expiresAt: new Date() },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
  };

  it('returns 401 when unauthenticated', async () => {
    (auth.api.getSession as jest.Mock).mockResolvedValue(null);

    const response = await request(app).get('/api/v1/worker/notifications/stream');

    expect(response.status).toBe(401);
  });

  it('returns 403 for non-worker roles', async () => {
    mockWorkerAuth({ role: 'OUTLET_ADMIN' });

    const response = await request(app).get('/api/v1/worker/notifications/stream');

    expect(response.status).toBe(403);
  });

  it('returns 422 when worker station or outlet is not configured', async () => {
    mockWorkerAuth({ workerType: null });

    const response = await request(app).get('/api/v1/worker/notifications/stream');

    expect(response.status).toBe(422);
    expect(response.body.message).toBe(
      'Worker station or outlet assignment is not configured',
    );
  });

  it('opens the worker notification stream for a valid worker', async () => {
    mockWorkerAuth();
    jest
      .spyOn(WorkerNotificationService, 'subscribe')
      .mockImplementation(async (_staff, _req, res) => {
        res.status(200).json({ status: 'success', message: 'stream-opened' });
      });

    const response = await request(app).get('/api/v1/worker/notifications/stream');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('stream-opened');
  });
});
