import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response-error';

export class BypassRequestService {
  /**
   * Validate admin password input (required field)
   */
  private static validatePassword(password: string) {
    if (!password) {
      throw new ResponseError(400, 'password is required');
    }
  }

  /**
   * Validate outlet ownership for OUTLET_ADMIN
   */
  private static validateOwnership(admin: any, bypass: any) {
    if (admin.role === 'SUPER_ADMIN') return;

    const adminOutletId = admin.outletId;
    const orderOutletId = bypass.stationRecord.order.outletId;

    if (adminOutletId !== orderOutletId) {
      throw new ResponseError(403, 'Forbidden access to this outlet');
    }
  }

  /**
   * Approve bypass request
   */
  static async approve(
    user: any,
    bypassId: string,
    input: { password: string; problemDescription: string }
  ) {
    const { password, problemDescription } = input;

    if (!problemDescription) {
      throw new ResponseError(400, 'problemDescription is required');
    }

    // Validate password presence
    this.validatePassword(password);

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

    this.validateOwnership(user, bypass);

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
    user: any,
    bypassId: string,
    input: { password: string; problemDescription: string }
  ) {
    const { password, problemDescription } = input;

    if (!problemDescription) {
      throw new ResponseError(400, 'problemDescription is required');
    }

    this.validatePassword(password);

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

    this.validateOwnership(user, bypass);

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