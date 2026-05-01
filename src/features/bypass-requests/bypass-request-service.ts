import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import {
  AdminContext,
  CreateBypassRequestInput,
  toBypassResponse,
  toBypassCreateResponse,
  toApproveBypassResponse,
  toRejectBypassResponse,
  toBypassDetailResponse,
} from './bypass-request-model';
import type { Prisma, Staff } from '@/generated/prisma/client';
import { resolveStationFromOrderStatus } from '@/features/worker-notifications/worker-notification-model';
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service';
import { findNextStationWorker } from '@/features/worker-orders/worker-order-helper';
import {
  advanceOrderStatus,
  assertMismatch,
  assertNoPendingBypass,
  assertOutletAccess,
  buildBypassWhere,
  BypassStatus,
  fetchReferenceItems,
  fetchReferenceQuantities,
  loadAndVerifyBypass,
  loadStationRecord,
  saveStationItems,
  StationStatus,
} from './bypass-request-helpers';
import { getBypassDetail, getBypassList } from './bypass-request-query';
import type { StationType } from '@/generated/prisma/client';
import type { BypassListQuery } from '@/validations/bypass-request-validation';

const createNextStationRecord = async (
  tx: Prisma.TransactionClient,
  order: { id: string; outletId: string },
  orderStatus: string,
) => {
  // Approved bypasses should continue the order flow exactly like a successful station completion.
  const nextStation = resolveStationFromOrderStatus(orderStatus);
  if (!nextStation) return;

  const existing = await tx.stationRecord.findUnique({
    where: { orderId_station: { orderId: order.id, station: nextStation } },
  });
  if (existing) return;

  const nextWorker = await findNextStationWorker(order.outletId, nextStation);
  await tx.stationRecord.create({
    data: {
      orderId: order.id,
      station: nextStation,
      staffId: nextWorker.id,
      status: StationStatus.IN_PROGRESS,
    },
  });
};

export class BypassRequestService {
  static async create(
    worker: Staff,
    orderId: string,
    station: StationType,
    data: CreateBypassRequestInput,
  ) {
    return prisma.$transaction(async (tx) => {
      // Workers can only request a bypass while they still own an in-progress station record.
      const sr = await loadStationRecord(tx, orderId, station, worker);
      if (sr.status !== StationStatus.IN_PROGRESS) {
        throw new ResponseError(409, 'Station is not in progress');
      }
      const refItems = await fetchReferenceQuantities(tx, orderId, station);
      assertMismatch(refItems, data.items);
      await assertNoPendingBypass(tx, sr.id);
      await saveStationItems(tx, sr.id, data.items);
      const bypass = await tx.bypassRequest.create({
        data: {
          stationRecordId: sr.id,
          workerId: worker.id,
          adminId: null,
          status: BypassStatus.PENDING,
          problemDescription: data.notes ?? null,
        },
      });
      await tx.stationRecord.update({
        where: { id: sr.id },
        data: { staffId: worker.id, status: StationStatus.BYPASS_REQUESTED },
      });
      return toBypassCreateResponse(bypass);
    });
  }

  static async getAll(
    role: string,
    outletId: string | undefined,
    query: BypassListQuery,
  ) {
    const { page, limit, status, order = 'desc' } = query;
    const where = buildBypassWhere(role, outletId, status);
    const [data, total] = await Promise.all([
      getBypassList({ where, order, page, limit }),
      prisma.bypassRequest.count({ where }),
    ]);
    const responses = await Promise.all(
      data.map(async (bypass) => {
        const referenceItems = await fetchReferenceItems(
          bypass.stationRecord.orderId,
          bypass.stationRecord.station,
        );
        return toBypassResponse(bypass, referenceItems);
      }),
    );

    return {
      data: responses,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async approve(
    admin: AdminContext,
    bypassId: string,
    password: string,
    problemDescription: string,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      // Approve means accepting the mismatch, closing the current station, and moving the order forward.
      const bypass = await loadAndVerifyBypass(tx, admin, bypassId, password);
      const updated = await tx.bypassRequest.update({
        where: { id: bypassId },
        data: { status: BypassStatus.APPROVED, adminId: admin.staffId, problemDescription, resolvedAt: new Date() },
      });
      await tx.stationRecord.update({
        where: { id: bypass.stationRecordId },
        data: { status: StationStatus.COMPLETED, completedAt: new Date() },
      });
      const nextStatus = await advanceOrderStatus(tx, bypass.stationRecord.order);
      await createNextStationRecord(tx, bypass.stationRecord.order, nextStatus);

      return {
        orderId: bypass.stationRecord.order.id,
        outletId: bypass.stationRecord.order.outletId,
        response: toApproveBypassResponse(updated, nextStatus),
      };
    });

    WorkerNotificationService.publishOrderArrival({
      orderId: result.orderId,
      outletId: result.outletId,
      orderStatus: result.response.orderStatus,
    });

    return result.response;
  }

  static async reject(
    admin: AdminContext,
    bypassId: string,
    password: string,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      // Reject sends the worker back to the same station so they can re-enter the quantities correctly.
      const bypass = await loadAndVerifyBypass(tx, admin, bypassId, password);
      const updated = await tx.bypassRequest.update({
        where: { id: bypassId },
        data: { status: BypassStatus.REJECTED, adminId: admin.staffId, resolvedAt: new Date() },
      });
      await tx.stationRecord.update({ where: { id: bypass.stationRecordId }, data: { status: StationStatus.IN_PROGRESS } });
      return {
        orderId: bypass.stationRecord.order.id,
        outletId: bypass.stationRecord.order.outletId,
        orderStatus: bypass.stationRecord.order.status,
        response: toRejectBypassResponse(updated),
      };
    });

    WorkerNotificationService.publishOrderArrival({
      orderId: result.orderId,
      outletId: result.outletId,
      orderStatus: result.orderStatus,
    });

    return result.response;
  }

  static async getById(
    role: string,
    outletId: string | null | undefined,
    bypassId: string,
  ) {
    const bypass = await getBypassDetail(bypassId);
    if (!bypass) throw new ResponseError(404, 'Bypass request not found');
    assertOutletAccess(role, outletId, bypass.stationRecord.order.outletId);
    const referenceItems = await fetchReferenceItems(bypass.stationRecord.orderId, bypass.stationRecord.station);
    return toBypassDetailResponse(bypass, referenceItems);
  }
}
