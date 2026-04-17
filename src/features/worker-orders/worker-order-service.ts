import { prisma } from '@/application/database';
import type { Prisma, Staff, StationType } from '@/generated/prisma/client';
import { ResponseError } from '@/error/response-error';
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service';
import { resolveStationFromOrderStatus } from '@/features/worker-notifications/worker-notification-model';
import {
  advanceOrderStatus,
  fetchReferenceItems,
  fetchReferenceQuantities,
  saveStationItems,
  StationStatus,
} from '@/features/bypass-requests/bypass-request-helpers';
import {
  toWorkerOrderDetailResponse,
  type WorkerOrderListQuery,
  type WorkerOrderProcessInput,
  toWorkerOrderProcessResponse,
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

const getWorkerQueueContext = (staff: Staff) => {
  if (!staff.outletId || !staff.workerType) {
    throw new ResponseError(
      422,
      'Worker station or outlet assignment is not configured',
    );
  }

  return {
    outletId: staff.outletId,
    workerType: staff.workerType,
  };
};

const assertQuantitiesMatch = (
  reference: Array<{ laundryItemId: string; quantity: number }>,
  submitted: WorkerOrderProcessInput['items'],
) => {
  const referenceMap = new Map(
    reference.map((item) => [item.laundryItemId, item.quantity]),
  );
  const submittedMap = new Map(
    submitted.map((item) => [item.laundryItemId, item.quantity]),
  );
  const isMatch =
    referenceMap.size === submittedMap.size &&
    [...referenceMap].every(([id, quantity]) => submittedMap.get(id) === quantity);

  if (!isMatch) {
    throw new ResponseError(400, 'Quantity mismatch detected');
  }
};

const loadWorkerStationRecordForProcess = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  station: StationType,
  workerId: string,
) => {
  const stationRecord = await tx.stationRecord.findUnique({
    where: { orderId_station: { orderId, station } },
    include: {
      order: true,
      stationItems: true,
    },
  });

  if (!stationRecord) {
    throw new ResponseError(404, 'Station record not found');
  }

  if (stationRecord.staffId !== workerId) {
    throw new ResponseError(403, 'You are not assigned to this station');
  }

  return stationRecord;
};

const findNextStationWorker = async (
  outletId: string,
  station: StationType,
) => {
  const worker = await prisma.staff.findFirst({
    where: {
      role: 'WORKER',
      isActive: true,
      outletId,
      workerType: station,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!worker) {
    throw new ResponseError(
      422,
      `No active worker configured for ${station} station`,
    );
  }

  return worker;
};

export class WorkerOrderService {
  static async getWorkerOrders(staff: Staff, query: WorkerOrderListQuery) {
    const queueContext = getWorkerQueueContext(staff);

    const skip = (query.page - 1) * query.limit;
    const where = buildWorkerOrdersWhere(
      { ...staff, ...queueContext },
      query,
    );

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

  static async getWorkerOrderDetail(staff: Staff, orderId: string) {
    const queueContext = getWorkerQueueContext(staff);

    const record = await prisma.stationRecord.findFirst({
      where: {
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
  }

  static async processWorkerOrder(
    staff: Staff,
    orderId: string,
    data: WorkerOrderProcessInput,
  ) {
    const queueContext = getWorkerQueueContext(staff);

    const result = await prisma.$transaction(async (tx) => {
      const stationRecord = await loadWorkerStationRecordForProcess(
        tx,
        orderId,
        queueContext.workerType,
        staff.id,
      );

      if (stationRecord.status !== StationStatus.IN_PROGRESS) {
        throw new ResponseError(409, 'Station is not in progress');
      }

      const referenceItems = await fetchReferenceQuantities(
        tx,
        orderId,
        queueContext.workerType,
      );
      assertQuantitiesMatch(referenceItems, data.items);

      await saveStationItems(tx, stationRecord.id, data.items);

      const completedRecord = await tx.stationRecord.update({
        where: { id: stationRecord.id },
        data: {
          status: StationStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      const nextOrderStatus = await advanceOrderStatus(tx, stationRecord.order);
      const nextStation = resolveStationFromOrderStatus(nextOrderStatus);

      if (nextStation) {
        const nextWorker = await findNextStationWorker(
          stationRecord.order.outletId,
          nextStation,
        );

        await tx.stationRecord.create({
          data: {
            orderId,
            station: nextStation,
            staffId: nextWorker.id,
            status: StationStatus.IN_PROGRESS,
          },
        });
      }

      return {
        orderId: stationRecord.order.id,
        outletId: stationRecord.order.outletId,
        response: toWorkerOrderProcessResponse(
          completedRecord,
          nextOrderStatus,
        ),
      };
    });

    WorkerNotificationService.publishOrderArrival({
      orderId: result.orderId,
      outletId: result.outletId,
      orderStatus: result.response.orderStatus,
    });

    return result.response;
  }
}
