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
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service';
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
import type { StationType } from '@/generated/prisma/client';
import type { BypassListQuery } from '@/validations/bypass-request-validation';

const BYPASS_LIST_INCLUDE = {
  stationRecord: { include: { order: true } },
  worker: { include: { user: true } },
  admin: { include: { user: true } },
} as const;

const BYPASS_DETAIL_INCLUDE = {
  stationRecord: {
    include: {
      order: true,
      stationItems: { include: { laundryItem: true } },
    },
  },
  worker: { include: { user: true } },
  admin: { include: { user: true } },
} as const;

export class BypassRequestService {
  static async create(
    workerId: string,
    orderId: string,
    station: StationType,
    data: CreateBypassRequestInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const sr = await loadStationRecord(tx, orderId, station, workerId);
      const refItems = await fetchReferenceQuantities(tx, orderId, station);
      assertMismatch(refItems, data.items);
      await assertNoPendingBypass(tx, sr.id);
      await saveStationItems(tx, sr.id, data.items);
      const bypass = await tx.bypassRequest.create({
        data: {
          stationRecordId: sr.id,
          workerId,
          adminId: null,
          status: BypassStatus.PENDING,
          problemDescription: data.notes ?? null,
        },
      });
      await tx.stationRecord.update({ where: { id: sr.id }, data: { status: StationStatus.BYPASS_REQUESTED } });
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
      prisma.bypassRequest.findMany({
        where,
        include: BYPASS_LIST_INCLUDE,
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bypassRequest.count({ where }),
    ]);
    return {
      data: data.map(toBypassResponse),
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
    const bypass = await prisma.bypassRequest.findUnique({
      where: { id: bypassId },
      include: BYPASS_DETAIL_INCLUDE,
    });
    if (!bypass) throw new ResponseError(404, 'Bypass request not found');
    assertOutletAccess(role, outletId, bypass.stationRecord.order.outletId);
    const referenceItems = await fetchReferenceItems(bypass.stationRecord.orderId, bypass.stationRecord.station);
    return toBypassDetailResponse(bypass, referenceItems);
  }
}
