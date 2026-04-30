import { prisma } from '@/application/database';

export const BYPASS_LIST_INCLUDE = {
  stationRecord: {
    include: {
      order: true,
      stationItems: { include: { laundryItem: true } },
    },
  },
  worker: { include: { user: true } },
  admin: { include: { user: true } },
} as const;

export const BYPASS_DETAIL_INCLUDE = {
  stationRecord: {
    include: {
      order: true,
      stationItems: { include: { laundryItem: true } },
    },
  },
  worker: { include: { user: true } },
  admin: { include: { user: true } },
} as const;

export const getBypassList = (args: {
  where: object;
  order: 'asc' | 'desc';
  page: number;
  limit: number;
}) => {
  const { where, order, page, limit } = args;
  return prisma.bypassRequest.findMany({
    where,
    include: BYPASS_LIST_INCLUDE,
    orderBy: { createdAt: order },
    skip: (page - 1) * limit,
    take: limit,
  });
};

export const getBypassDetail = (bypassId: string) =>
  prisma.bypassRequest.findUnique({
    where: { id: bypassId },
    include: BYPASS_DETAIL_INCLUDE,
  });
