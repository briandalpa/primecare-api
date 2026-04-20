import { prisma } from '@/application/database';
import type { Prisma, Staff, StationType } from '@/generated/prisma/client';
import { ResponseError } from '@/error/response-error';
import {
  type WorkerHistoryQuery,
  type WorkerOrderListQuery,
  type WorkerOrderProcessInput,
} from './worker-order-model';
import { StationStatus } from '@/features/bypass-requests/bypass-request-helpers';

export const buildWorkerOrdersWhere = (
  staff: Staff,
  query: WorkerOrderListQuery,
) => {
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

export const buildWorkerHistoryWhere = (
  staff: Staff,
  query: WorkerHistoryQuery,
) => {
  const where: Record<string, unknown> = {
    staffId: staff.id,
    status: StationStatus.COMPLETED,
    order: { outletId: staff.outletId },
  };

  if (query.station) where.station = query.station;

  if (query.date) {
    const startOfDay = new Date(`${query.date}T00:00:00.000Z`);
    const endOfDay = new Date(`${query.date}T23:59:59.999Z`);

    where.completedAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  return where;
};

export const getWorkerQueueContext = (staff: Staff) => {
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

export const assertQuantitiesMatch = (
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
    [...referenceMap].every(
      ([id, quantity]) => submittedMap.get(id) === quantity,
    );

  if (!isMatch) {
    throw new ResponseError(400, 'Quantity mismatch detected');
  }
};

export const loadWorkerStationRecordForProcess = async (
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

export const findNextStationWorker = async (
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
