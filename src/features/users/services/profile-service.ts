import { prisma } from '@/application/database'
import { ResponseError } from '@/error/response-error'

export class ProfileService {

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { staff: true },
    })

    if (!user) throw new ResponseError(404, 'User not found')

    return {
      id: user.id,
      name: user.name ?? '',
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      createdAt: user.createdAt,
      staff: user.staff
        ? {
            role: user.staff.role,
            workerType: user.staff.workerType,
            outletId: user.staff.outletId,
            isActive: user.staff.isActive,
          }
        : null,
    }
  }

}