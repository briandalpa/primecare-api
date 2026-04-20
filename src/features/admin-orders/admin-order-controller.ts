import { AdminOrderValidation } from '@/validations/admin-order-validation'
import { Validation } from '@/validations/validation'
import { NextFunction, Response } from 'express'
import { UserRequest } from '@/types/user-request'
import { AdminOrderService } from './admin-order-service'

export class AdminOrderController {

  static async getAdminOrders(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const result = await AdminOrderService.getAdminOrders(req.staff!, {
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 10, 100),
        status: req.query.status as string | undefined,
        outletId: req.query.outletId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || undefined,
      })

      res.status(200).json({
        status: 'success',
        message: 'Orders retrieved successfully',
        data: result.data,
        meta: result.meta
      })

    } catch (error) {
      next(error)
    }
  }

  static async getAdminOrderDetail(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const orderId = req.params.id as string

      const result = await AdminOrderService.getAdminOrderDetail(
        req.staff!,
        orderId
      )

      res.status(200).json({
        status: 'success',
        message: 'Order retrieved successfully',
        data: result
      })

    } catch (error) {
      next(error)
    }
  }

  static async createAdminOrder(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const data = Validation.validate(AdminOrderValidation.CREATE_ORDER, req.body)

      const result = await AdminOrderService.createAdminOrder(req.staff!, data)

      res.status(201).json({
        status: 'success',
        message: 'Order created successfully',
        data: result
      })

    } catch (error) {
      next(error)
    }
  }

  static async getAdminPickupRequests(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const page = Number(req.query.page) || 1
      const limit = Math.min(Number(req.query.limit) || 10, 100)

      const result = await AdminOrderService.getAdminPickupRequests(
        req.staff!,
        page,
        limit
      )

      res.status(200).json({
        status: 'success',
        message: 'Pickup requests retrieved successfully',
        data: result.data,
        meta: result.meta
      })

    } catch (error) {
      next(error)
    }
  }

  static async getLaundryItems(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const items = await AdminOrderService.getLaundryItems()

      res.status(200).json({
        status: 'success',
        message: 'Laundry items retrieved',
        data: items
      })

    } catch (error) {
      next(error)
    }
  }
}
