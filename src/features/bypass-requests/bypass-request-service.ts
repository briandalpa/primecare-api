import bcrypt from 'bcrypt';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import {
  CreateBypassRequestInput,
  toBypassResponse,
  toBypassCreateResponse,
  toApproveBypassResponse,
  toRejectBypassResponse,
  toBypassDetailResponse,
  BypassStatus,
  BypassItemResponse,
} from './bypass-request-model';
import type { StationType, OrderStatus, Prisma } from '@/generated/prisma/client';

async function loadStationRecord(
  tx: Prisma.TransactionClient,
  orderId: string,
  station: StationType,
  workerId: string
) {
  const sr = await tx.stationRecord.findUnique({
    where: { orderId_station: { orderId, station } },
    include: { stationItems: true },
  });
  if (!sr) throw new ResponseError(404, 'Station record not found');
  if (sr.staffId !== workerId) throw new ResponseError(403, 'You are not assigned to this station');
  return sr;
}

async function fetchReferenceItems(
  tx: Prisma.TransactionClient,
  orderId: string,
  station: StationType
): Promise<Array<{ laundryItemId: string; quantity: number }>> {
  if (station === 'WASHING') {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    return items.map((i) => ({ laundryItemId: i.laundryItemId, quantity: i.quantity }));
  }
  const prevStation = station === 'IRONING' ? 'WASHING' : 'IRONING';
  const prev = await tx.stationRecord.findUnique({
    where: { orderId_station: { orderId, station: prevStation } },
    include: { stationItems: true },
  });
  if (!prev) throw new ResponseError(422, 'Previous station has no completed records. Cannot proceed.');
  return prev.stationItems.map((i) => ({ laundryItemId: i.laundryItemId, quantity: i.quantity }));
}

function assertMismatch(
  reference: Array<{ laundryItemId: string; quantity: number }>,
  submitted: Array<{ laundryItemId: string; quantity: number }>
) {
  const refMap = new Map(reference.map((i) => [i.laundryItemId, i.quantity]));
  const subMap = new Map(submitted.map((i) => [i.laundryItemId, i.quantity]));
  const hasMatch = refMap.size === subMap.size && [...refMap].every(([id, qty]) => subMap.get(id) === qty);
  if (hasMatch) throw new ResponseError(400, 'No quantity mismatch detected');
}

async function assertNoPendingBypass(tx: Prisma.TransactionClient, stationRecordId: string) {
  const existing = await tx.bypassRequest.findFirst({ where: { stationRecordId, status: 'PENDING' } });
  if (existing) throw new ResponseError(409, 'A pending bypass request already exists for this station');
}

async function verifyAdminPassword(tx: Prisma.TransactionClient, adminUserId: string, password: string) {
  const account = await tx.account.findFirst({ where: { userId: adminUserId, providerId: 'credential' } });
  if (!account?.password) throw new ResponseError(401, 'Incorrect password');
  if (!(await bcrypt.compare(password, account.password))) throw new ResponseError(401, 'Incorrect password');
}

async function loadPendingBypass(tx: Prisma.TransactionClient, bypassId: string) {
  const bypass = await tx.bypassRequest.findUnique({
    where: { id: bypassId },
    include: { stationRecord: { include: { order: true } } },
  });
  if (!bypass) throw new ResponseError(404, 'Bypass request not found');
  if (bypass.status !== 'PENDING') throw new ResponseError(409, 'Bypass request is not in PENDING state');
  return bypass;
}

function assertOutletAccess(role: string, adminOutletId: string | undefined, bypassOutletId: string) {
  if (role === 'OUTLET_ADMIN' && adminOutletId && bypassOutletId !== adminOutletId) {
    throw new ResponseError(403, 'Access denied');
  }
}

async function advanceOrderStatus(
  tx: Prisma.TransactionClient,
  order: { id: string; status: string; paymentStatus: string }
): Promise<OrderStatus> {
  let nextStatus: OrderStatus;
  if (order.status === 'LAUNDRY_BEING_WASHED') nextStatus = 'LAUNDRY_BEING_IRONED';
  else if (order.status === 'LAUNDRY_BEING_IRONED') nextStatus = 'LAUNDRY_BEING_PACKED';
  else if (order.status === 'LAUNDRY_BEING_PACKED') {
    if (order.paymentStatus === 'PAID') {
      nextStatus = 'LAUNDRY_READY_FOR_DELIVERY';
      // delivery.create must stay on tx — if it fails, all writes in approve() roll back
      await tx.delivery.create({ data: { orderId: order.id } });
    } else {
      nextStatus = 'WAITING_FOR_PAYMENT';
    }
  } else {
    throw new ResponseError(422, `Cannot approve bypass: order status '${order.status}' is not a station-processing status`);
  }
  await tx.order.update({ where: { id: order.id }, data: { status: nextStatus } });
  return nextStatus;
}

async function fetchDetailReferenceItems(station: StationType, orderId: string): Promise<BypassItemResponse[]> {
  if (station === 'WASHING') {
    const items = await prisma.orderItem.findMany({ where: { orderId }, include: { laundryItem: true } });
    return items.map((i) => ({ laundryItemId: i.laundryItemId, itemName: i.laundryItem.name, quantity: i.quantity }));
  }
  const prevStation = station === 'IRONING' ? 'WASHING' : 'IRONING';
  const prev = await prisma.stationRecord.findUnique({
    where: { orderId_station: { orderId, station: prevStation } },
    include: { stationItems: { include: { laundryItem: true } } },
  });
  if (!prev) throw new ResponseError(422, `Previous station record for '${prevStation}' not found. Reference items cannot be resolved.`);
  return prev.stationItems.map((i) => ({ laundryItemId: i.laundryItemId, itemName: i.laundryItem.name, quantity: i.quantity }));
}

export class BypassRequestService {
  static async create(workerId: string, orderId: string, station: StationType, data: CreateBypassRequestInput) {
    return prisma.$transaction(async (tx) => {
      const sr = await loadStationRecord(tx, orderId, station, workerId);
      const refItems = await fetchReferenceItems(tx, orderId, station);
      assertMismatch(refItems, data.items);
      await assertNoPendingBypass(tx, sr.id);
      await tx.stationItem.deleteMany({ where: { stationRecordId: sr.id } });
      await Promise.all(
        data.items.map((item) =>
          tx.stationItem.create({ data: { stationRecordId: sr.id, laundryItemId: item.laundryItemId, quantity: item.quantity } })
        )
      );
      const bypass = await tx.bypassRequest.create({
        data: { stationRecordId: sr.id, workerId, adminId: null, status: 'PENDING', problemDescription: null },
      });
      await tx.stationRecord.update({ where: { id: sr.id }, data: { status: 'BYPASS_REQUESTED' } });
      return toBypassCreateResponse(bypass);
    });
  }

  static async getAll(
    adminId: string,
    role: string,
    outletId: string | undefined,
    options: { page: number; limit: number; status?: BypassStatus; order?: 'asc' | 'desc' }
  ) {
    const { page, limit, status, order = 'desc' } = options;
    const where: Prisma.BypassRequestWhereInput = {};
    if (status) where.status = status;
    if (role === 'OUTLET_ADMIN' && outletId) where.stationRecord = { order: { outletId } };
    const include = {
      stationRecord: { include: { order: true } },
      worker: { include: { user: true } },
      admin: { include: { user: true } },
    };
    const [data, total] = await Promise.all([
      prisma.bypassRequest.findMany({ where, include, orderBy: { createdAt: order }, skip: (page - 1) * limit, take: limit }),
      prisma.bypassRequest.count({ where }),
    ]);
    return { data: data.map(toBypassResponse), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async approve(
    adminStaffId: string,
    adminUserId: string,
    adminRole: string,
    adminOutletId: string | undefined,
    bypassId: string,
    password: string,
    problemDescription: string
  ) {
    return prisma.$transaction(async (tx) => {
      await verifyAdminPassword(tx, adminUserId, password);
      const bypass = await loadPendingBypass(tx, bypassId);
      assertOutletAccess(adminRole, adminOutletId, bypass.stationRecord.order.outletId);
      const updated = await tx.bypassRequest.update({
        where: { id: bypassId },
        data: { status: 'APPROVED', adminId: adminStaffId, problemDescription, resolvedAt: new Date() },
      });
      await tx.stationRecord.update({ where: { id: bypass.stationRecordId }, data: { status: 'COMPLETED', completedAt: new Date() } });
      const nextStatus = await advanceOrderStatus(tx, bypass.stationRecord.order);
      return toApproveBypassResponse(updated, nextStatus);
    });
  }

  static async reject(
    adminStaffId: string,
    adminUserId: string,
    adminRole: string,
    adminOutletId: string | undefined,
    bypassId: string,
    password: string
  ) {
    return prisma.$transaction(async (tx) => {
      await verifyAdminPassword(tx, adminUserId, password);
      const bypass = await loadPendingBypass(tx, bypassId);
      assertOutletAccess(adminRole, adminOutletId, bypass.stationRecord.order.outletId);
      const updated = await tx.bypassRequest.update({
        where: { id: bypassId },
        data: { status: 'REJECTED', adminId: adminStaffId, resolvedAt: new Date() },
      });
      await tx.stationRecord.update({ where: { id: bypass.stationRecordId }, data: { status: 'IN_PROGRESS' } });
      return toRejectBypassResponse(updated);
    });
  }

  static async getById(role: string, outletId: string | undefined, bypassId: string) {
    const bypass = await prisma.bypassRequest.findUnique({
      where: { id: bypassId },
      include: {
        stationRecord: { include: { order: true, stationItems: { include: { laundryItem: true } } } },
        worker: { include: { user: true } },
        admin: { include: { user: true } },
      },
    });
    if (!bypass) throw new ResponseError(404, 'Bypass request not found');
    assertOutletAccess(role, outletId, bypass.stationRecord.order.outletId);
    const referenceItems = await fetchDetailReferenceItems(bypass.stationRecord.station, bypass.stationRecord.orderId);
    return toBypassDetailResponse(bypass, referenceItems);
  }
}
