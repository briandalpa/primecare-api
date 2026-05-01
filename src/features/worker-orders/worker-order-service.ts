import { prisma } from '@/application/database';
import type { Staff } from '@/generated/prisma/client';
import { ResponseError } from '@/error/response-error';
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service';
import { resolveStationFromOrderStatus } from '@/features/worker-notifications/worker-notification-model';
import {
  advanceOrderStatus,
  fetchReferenceQuantities,
  saveStationItems,
  StationStatus,
} from '@/features/bypass-requests/bypass-request-helpers';
import {
  type WorkerHistoryQuery,
  type WorkerOrderListQuery,
  type WorkerOrderProcessInput,
} from './worker-order-model';
import {
  assertQuantitiesMatch,
  findNextStationWorker,
  getWorkerQueueContext,
  loadWorkerStationRecordForProcess,
} from './worker-order-helper';
import { toWorkerOrderProcessResponse } from './worker-order-mapper';
import {
  getWorkerHistory,
  getWorkerOrderDetail,
  getWorkerOrders,
} from './worker-order-query';
import { sendPackingUnpaidPaymentReminder } from './worker-payment-reminder';

export class WorkerOrderService {
  static async getWorkerOrders(staff: Staff, query: WorkerOrderListQuery) {
    return getWorkerOrders(staff, query);
  }

  static async getWorkerOrderDetail(staff: Staff, orderId: string) {
    return getWorkerOrderDetail(staff, orderId);
  }

  static async getWorkerHistory(staff: Staff, query: WorkerHistoryQuery) {
    return getWorkerHistory(staff, query);
  }

  static async processWorkerOrder(
    staff: Staff,
    orderId: string,
    data: WorkerOrderProcessInput,
  ) {
    // The worker queue context narrows processing to the station type that belongs to the logged-in worker.
    const queueContext = getWorkerQueueContext(staff);

    const result = await prisma.$transaction(async (tx) => {
      const stationRecord = await loadWorkerStationRecordForProcess(
        tx,
        orderId,
        queueContext.workerType,
        staff,
      );

      if (stationRecord.status !== StationStatus.IN_PROGRESS) {
        throw new ResponseError(409, 'Station is not in progress');
      }

      const referenceItems = await fetchReferenceQuantities(
        tx,
        orderId,
        queueContext.workerType,
      );
      // A normal station completion is only allowed when the worker re-enters the exact expected quantities.
      assertQuantitiesMatch(referenceItems, data.items);

      await saveStationItems(tx, stationRecord.id, data.items);

      const completedRecord = await tx.stationRecord.update({
        where: { id: stationRecord.id },
        data: {
          staffId: staff.id,
          status: StationStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      const nextOrderStatus = await advanceOrderStatus(tx, stationRecord.order);
      const nextStation = resolveStationFromOrderStatus(nextOrderStatus);

      if (nextStation) {
        // Each completed station hands the order to the next station worker who is currently on shift.
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

    if (result.response.orderStatus === 'WAITING_FOR_PAYMENT') {
      void sendPackingUnpaidPaymentReminder(result.orderId);
    }

    return result.response;
  }
}


