import { prisma } from '@/application/database';
import type { Staff } from '@/generated/prisma/client';
import { ResponseError } from '@/error/response-error';
import { fetchReferenceItems } from '@/features/bypass-requests/bypass-request-helpers';
import {
  toWorkerHistoryResponse,
  toWorkerOrderDetailResponse,
  toWorkerOrderResponse,
} from './worker-order-mapper';
import type {
  WorkerHistoryQuery,
  WorkerOrderListQuery,
} from './worker-order-model';
import {
  buildWorkerHistoryWhere,
  buildWorkerOrdersWhere,
  getWorkerQueueContext,
} from './worker-order-helper';

export const getWorkerOrders = async (
  staff: Staff,
  query: WorkerOrderListQuery,
) => {
  const queueContext = getWorkerQueueContext(staff);
  const skip = (query.page - 1) * query.limit;
  const where = buildWorkerOrdersWhere({ ...staff, ...queueContext }, query);

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
};

export const getWorkerOrderDetail = async (staff: Staff, orderId: string) => {
  const queueContext = getWorkerQueueContext(staff);

  const record = await prisma.stationRecord.findFirst({
    where: {
      staffId: staff.id,
      orderId,
      station: queueContext.workerType,
      order: { outletId: queueContext.outletId },
    },
    include: {
      stationItems: {
        include: {
          laundryItem: {
            select: { name: true },
          },
        },
      },
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
  });

  if (!record) {
    throw new ResponseError(404, 'Worker order not found');
  }

  const referenceItems = await fetchReferenceItems(orderId, record.station);

  return toWorkerOrderDetailResponse(
    record as Parameters<typeof toWorkerOrderDetailResponse>[0],
    referenceItems,
  );
};

export const getWorkerHistory = async (
  staff: Staff,
  query: WorkerHistoryQuery,
) => {
  const queueContext = getWorkerQueueContext(staff);
  const skip = (query.page - 1) * query.limit;
  const where = buildWorkerHistoryWhere({ ...staff, ...queueContext }, query);

  const [records, total] = await Promise.all([
    prisma.stationRecord.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { completedAt: 'desc' },
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
    data: records.map(toWorkerHistoryResponse),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};
