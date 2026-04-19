import { NextFunction, Response } from 'express'
import { UserRequest } from '@/types/user-request'
import { Validation } from '@/validations/validation'
import { AdminOutletValidation } from '@/validations/admin-outlet-validation'
import { AdminOutletService } from './admin-outlet-service'

const getId = (req: UserRequest) =>
  Validation.validate(AdminOutletValidation.PARAMS, { id: req.params.id }).id

export class AdminOutletController {
  static async getAdminOutlets(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const query = Validation.validate(AdminOutletValidation.QUERY, req.query)
      const result = await AdminOutletService.getAdminOutlets(req.staff!, query)
      res.status(200).json({ status: 'success', message: 'Outlets retrieved successfully', data: result.data, meta: result.meta })
    } catch (error) {
      next(error)
    }
  }

  static async createAdminOutlet(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(AdminOutletValidation.CREATE, req.body)
      const result = await AdminOutletService.createAdminOutlet(data)
      res.status(201).json({ status: 'success', message: 'Outlet created successfully', data: result })
    } catch (error) {
      next(error)
    }
  }

  static async getAdminOutletDetail(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const result = await AdminOutletService.getAdminOutletDetail(req.staff!, getId(req))
      res.status(200).json({ status: 'success', message: 'Outlet retrieved successfully', data: result })
    } catch (error) {
      next(error)
    }
  }

  static async updateAdminOutlet(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const data = Validation.validate(AdminOutletValidation.UPDATE, req.body)
      const result = await AdminOutletService.updateAdminOutlet(getId(req), data)
      res.status(200).json({ status: 'success', message: 'Outlet updated successfully', data: result })
    } catch (error) {
      next(error)
    }
  }

  static async deactivateAdminOutlet(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const result = await AdminOutletService.deactivateAdminOutlet(getId(req))
      res.status(200).json({ status: 'success', message: result.message })
    } catch (error) {
      next(error)
    }
  }
}
