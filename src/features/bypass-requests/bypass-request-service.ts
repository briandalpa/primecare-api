import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';

type Staff = {
  id: string;
  userId: string;
  role: 'SUPER_ADMIN' | 'OUTLET_ADMIN';
  outletId: string | null;
};

export class BypassRequestService {
  private static validatePassword(password: string) {
    if (!password) {
      throw new ResponseError(400, 'password is required');
    }
  }

  /**
   * DISABLE STRICT OWNERSHIP
   */
  private static validateOwnership() {
    return; // bypass sementara
  }

  /**
   * GET ALL PENDING (NO FILTER OUTLET)
   */
  static async getPending(user: { id: string }) {
    const staff = await prisma.staff.findFirst({
      where: { userId: user.id },
    });

    if (!staff) {
      throw new ResponseError(403, 'Staff not found');
    }

    const bypasses = await prisma.bypassRequest.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        stationRecord: {
          include: {
            order: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return bypasses;
  }

  /**
   * Approve bypass request
   */
  static async approve(
    user: { id: string },
    bypassId: string,
    input: { password: string; problemDescription: string }
  ) {
    const { password, problemDescription } = input;

    if (!problemDescription) {
      throw new ResponseError(400, 'problemDescription is required');
    }

    this.validatePassword(password);

    const staff = await prisma.staff.findFirst({
      where: { userId: user.id },
    });

    if (!staff) {
      throw new ResponseError(403, 'Staff not found');
    }

    const bypass = await prisma.bypassRequest.findUnique({
      where: { id: bypassId },
      include: {
        stationRecord: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!bypass) {
      throw new ResponseError(404, 'Bypass not found');
    }

    if (bypass.status !== 'PENDING') {
      throw new ResponseError(400, 'Bypass already processed');
    }

    this.validateOwnership();

    const [updated] = await prisma.$transaction([
      prisma.bypassRequest.update({
        where: { id: bypassId },
        data: {
          status: 'APPROVED',
          adminId: user.id,
          problemDescription,
          resolvedAt: new Date(),
        },
      }),

      prisma.stationRecord.update({
        where: { id: bypass.stationRecordId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      }),

      prisma.order.update({
        where: { id: bypass.stationRecord.orderId },
        data: {
          status: 'LAUNDRY_BEING_IRONED',
        },
      }),
    ]);

    return updated;
  }

  /**
   * Reject bypass request
   */
  static async reject(
    user: { id: string },
    bypassId: string,
    input: { password: string; problemDescription: string }
  ) {
    const { password, problemDescription } = input;

    if (!problemDescription) {
      throw new ResponseError(400, 'problemDescription is required');
    }

    this.validatePassword(password);

    const staff = await prisma.staff.findFirst({
      where: { userId: user.id },
    });

    if (!staff) {
      throw new ResponseError(403, 'Staff not found');
    }

    const bypass = await prisma.bypassRequest.findUnique({
      where: { id: bypassId },
      include: {
        stationRecord: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!bypass) {
      throw new ResponseError(404, 'Bypass not found');
    }

    if (bypass.status !== 'PENDING') {
      throw new ResponseError(400, 'Bypass already processed');
    }

    
    this.validateOwnership();

    const updated = await prisma.bypassRequest.update({
      where: { id: bypassId },
      data: {
        status: 'REJECTED',
        adminId: user.id,
        problemDescription,
        resolvedAt: new Date(),
      },
    });

    return updated;
  }
}