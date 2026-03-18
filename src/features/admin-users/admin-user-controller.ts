import { AdminUserValidation } from '@/validations/admin-user-validation'
import { Validation } from '@/validations/validation'
import { NextFunction, Response } from 'express'
import { UserRequest } from '@/types/user-request'
import { AdminUserService } from './admin-user-service'

export class AdminUserController {

  static async getAdminUsers(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const result = await AdminUserService.getAdminUsers(req.staff!, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        role: req.query.role as string | undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || undefined,
      })

      res.status(200).json({
        status: 'success',
        message: 'Users retrieved successfully',
        data: result.data,
        meta: result.meta
      })

    } catch (error) {
      next(error)
    }
  }

  static async createAdminUser(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const data = Validation.validate(
        AdminUserValidation.CREATE,
        req.body
      )

      const result = await AdminUserService.createAdminUser(data)

      res.status(201).json({
        status: 'success',
        message: 'Admin user created',
        data: result
      })

    } catch (error) {
      next(error)
    }
  }

  static async updateAdminUser(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const data = Validation.validate(
        AdminUserValidation.UPDATE,
        req.body
      )

      const id = req.params.id as string

      const result = await AdminUserService.updateAdminUser(
        id,
        data
      )

      res.status(200).json({
        status: 'success',
        message: 'Admin user updated',
        data: result
      })

    } catch (error) {
      next(error)
    }
  }

  static async deleteAdminUser(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const id = req.params.id as string

      const result = await AdminUserService.deleteAdminUser(id)

      res.status(200).json({
        status: 'success',
        message: result.message
      })

    } catch (error) {
      next(error)
    }
  }
}
