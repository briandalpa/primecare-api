import bcrypt from 'bcrypt';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';
import type { AdminContext, BypassItemResponse } from './bypass-request-model';
import {
  BypassStatus,
  OrderPaymentStatus,
  OrderStatus,
  StaffRole,
  StationStatus,
  StationType,
} from '@/generated/prisma/client';
import type { OrderStatus as OrderStatusType, Prisma, Staff, StationType as StationTypeValue } from '@/generated/prisma/client';

export function prevStationFor(station: Exclude<StationTypeValue, 'WASHING'>): StationTypeValue {
  return station === StationType.IRONING ? StationType.WASHING : StationType.IRONING;
}

export async function loadStationRecord(
  tx: Prisma.TransactionClient,
  orderId: string,
  station: StationTypeValue,
  worker: Staff,
) {
  const sr = await tx.stationRecord.findUnique({
    where: { orderId_station: { orderId, station } },
    include: { order: true, stationItems: true },
  });
  if (!sr) throw new ResponseError(404, 'Station record not found');
  if (sr.order.outletId !== worker.outletId)
    throw new ResponseError(403, 'You are not assigned to this outlet');
  return sr;
}

export async function fetchReferenceItems(
  orderId: string,
  station: StationTypeValue,
): Promise<BypassItemResponse[]> {
  if (station === StationType.WASHING) {
    const items = await prisma.orderItem.findMany({
      where: { orderId },
      include: { laundryItem: true },
    });
    return items.map((i) => ({ laundryItemId: i.laundryItemId, itemName: i.laundryItem.name, quantity: i.quantity }));
  }
  const prev = await prisma.stationRecord.findUnique({
    where: { orderId_station: { orderId, station: prevStationFor(station) } },
    include: { stationItems: { include: { laundryItem: true } } },
  });
  if (!prev) throw new ResponseError(422, 'Previous station has no completed records. Cannot proceed.');
  return prev.stationItems.map((i) => ({ laundryItemId: i.laundryItemId, itemName: i.laundryItem.name, quantity: i.quantity }));
}

export async function fetchReferenceQuantities(
  tx: Prisma.TransactionClient,
  orderId: string,
  station: StationTypeValue,
): Promise<Array<{ laundryItemId: string; quantity: number }>> {
  if (station === StationType.WASHING) {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    return items.map((i) => ({ laundryItemId: i.laundryItemId, quantity: i.quantity }));
  }
  const prev = await tx.stationRecord.findUnique({
    where: { orderId_station: { orderId, station: prevStationFor(station) } },
    include: { stationItems: true },
  });
  if (!prev) throw new ResponseError(422, 'Previous station has no completed records. Cannot proceed.');
  return prev.stationItems.map((i) => ({ laundryItemId: i.laundryItemId, quantity: i.quantity }));
}

export function assertMismatch(
  reference: Array<{ laundryItemId: string; quantity: number }>,
  submitted: Array<{ laundryItemId: string; quantity: number }>,
) {
  const refMap = new Map(reference.map((i) => [i.laundryItemId, i.quantity]));
  const subMap = new Map(submitted.map((i) => [i.laundryItemId, i.quantity]));
  const hasMatch =
    refMap.size === subMap.size &&
    [...refMap].every(([id, qty]) => subMap.get(id) === qty);
  if (hasMatch) throw new ResponseError(400, 'No quantity mismatch detected');
}

export async function assertNoPendingBypass(
  tx: Prisma.TransactionClient,
  stationRecordId: string,
) {
  const existing = await tx.bypassRequest.findFirst({
    where: { stationRecordId, status: BypassStatus.PENDING },
  });
  if (existing)
    throw new ResponseError(409, 'A pending bypass request already exists for this station');
}

export async function saveStationItems(
  tx: Prisma.TransactionClient,
  stationRecordId: string,
  items: Array<{ laundryItemId: string; quantity: number }>,
) {
  await tx.stationItem.deleteMany({ where: { stationRecordId } });
  await tx.stationItem.createMany({
    data: items.map((item) => ({ stationRecordId, laundryItemId: item.laundryItemId, quantity: item.quantity })),
  });
}

export async function verifyAdminPassword(
  tx: Prisma.TransactionClient,
  adminUserId: string,
  password: string,
) {
  const account = await tx.account.findFirst({
    where: { userId: adminUserId, providerId: 'credential' },
  });
  if (!account?.password) throw new ResponseError(401, 'Incorrect password');
  if (!(await bcrypt.compare(password, account.password)))
    throw new ResponseError(401, 'Incorrect password');
}

export async function loadPendingBypass(tx: Prisma.TransactionClient, bypassId: string) {
  const bypass = await tx.bypassRequest.findUnique({
    where: { id: bypassId },
    include: { stationRecord: { include: { order: true } } },
  });
  if (!bypass) throw new ResponseError(404, 'Bypass request not found');
  if (bypass.status !== BypassStatus.PENDING)
    throw new ResponseError(409, 'Bypass request is not in PENDING state');
  return bypass;
}

export function assertOutletAccess(
  role: string,
  adminOutletId: string | null | undefined,
  bypassOutletId: string,
) {
  if (role === StaffRole.OUTLET_ADMIN && adminOutletId && bypassOutletId !== adminOutletId)
    throw new ResponseError(403, 'Access denied');
}

export async function loadAndVerifyBypass(
  tx: Prisma.TransactionClient,
  admin: AdminContext,
  bypassId: string,
  password: string,
) {
  await verifyAdminPassword(tx, admin.userId, password);
  const bypass = await loadPendingBypass(tx, bypassId);
  assertOutletAccess(admin.role, admin.outletId, bypass.stationRecord.order.outletId);
  return bypass;
}

async function resolvePackingStatus(
  tx: Prisma.TransactionClient,
  order: { id: string; paymentStatus: string },
): Promise<OrderStatusType> {
  if (order.paymentStatus === OrderPaymentStatus.PAID) {
    await tx.delivery.create({ data: { orderId: order.id } });
    return OrderStatus.LAUNDRY_READY_FOR_DELIVERY;
  }
  return OrderStatus.WAITING_FOR_PAYMENT;
}

async function resolveNextStatus(
  tx: Prisma.TransactionClient,
  order: { id: string; status: string; paymentStatus: string },
): Promise<OrderStatusType> {
  if (order.status === OrderStatus.LAUNDRY_BEING_WASHED) return OrderStatus.LAUNDRY_BEING_IRONED;
  if (order.status === OrderStatus.LAUNDRY_BEING_IRONED) return OrderStatus.LAUNDRY_BEING_PACKED;
  if (order.status === OrderStatus.LAUNDRY_BEING_PACKED) return resolvePackingStatus(tx, order);
  throw new ResponseError(
    422,
    `Cannot approve bypass: order status '${order.status}' is not a station-processing status`,
  );
}

export async function advanceOrderStatus(
  tx: Prisma.TransactionClient,
  order: { id: string; status: string; paymentStatus: string },
): Promise<OrderStatusType> {
  const nextStatus = await resolveNextStatus(tx, order);
  await tx.order.update({ where: { id: order.id }, data: { status: nextStatus } });
  return nextStatus;
}

export function buildBypassWhere(
  role: string,
  outletId: string | undefined,
  status?: string,
): Prisma.BypassRequestWhereInput {
  const where: Prisma.BypassRequestWhereInput = {};
  if (status) where.status = status as BypassStatus;
  if (role === StaffRole.OUTLET_ADMIN && outletId)
    where.stationRecord = { order: { outletId } };
  return where;
}

export { BypassStatus, StationStatus };
