import { prisma } from '@/application/database';
import type { Staff } from '@/generated/prisma/client';
import { ResponseError } from '@/error/response-error';
import {
  type WorkerOrderListQuery,
  toWorkerOrderResponse,
} from './worker-order-model';

const buildWorkerOrdersWhere = (staff: Staff, query: WorkerOrderListQuery) => {
  const where: Record<string, unknown> = {
    station: staff.workerType,
    order: { outletId: staff.outletId },
  };

  if (query.status) where.status = query.status;

  if (query.date) {
    const startOfDay = new Date(`${query.date}T00:00:00.000Z`);
    const endOfDay = new Date(`${query.date}T23:59:59.999Z`);

    where.createdAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  return where;
};

const assertWorkerQueueContext = (staff: Staff) => {
  if (!staff.outletId || !staff.workerType) {
    throw new ResponseError(
      422,
      'Worker station or outlet assignment is not configured',
    );
  }
};

export class WorkerOrderService {
  static async getWorkerOrders(staff: Staff, query: WorkerOrderListQuery) {
    assertWorkerQueueContext(staff);

    const skip = (query.page - 1) * query.limit;
    const where = buildWorkerOrdersWhere(staff, query);

    const [records, total] = await Promise.all([
      prisma.stationRecord.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            include: {
              outlet: true,
              pickupRequest: {
                include: {
                  customerUser: {
                    select: { name: true },
                  },
                },
              },
              items: true,
            },
          },
        },
      }),
      prisma.stationRecord.count({ where }),
    ]);

    return {
      data: records.map(toWorkerOrderResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
