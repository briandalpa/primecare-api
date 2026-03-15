import { Validation } from '@/validations/validation'
import { AdminValidation } from '@/validations/admin-validation'
import { NextFunction, Response } from 'express'
import { UserRequest } from '@/types/user-request'
import { AdminService } from './admin-service'

export class AdminController {

  static async getAdminUsers(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const users = await AdminService.getAdminUsers(req.staff!)

      res.status(200).json({
        status: 'success',
        message: 'Users retrieved successfully',
        data: users
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
        AdminValidation.CREATE,
        req.body
      )

      const result = await AdminService.createAdminUser(data)

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
        AdminValidation.UPDATE,
        req.body
      )

      const id = req.params.id as string

      const result = await AdminService.updateAdminUser(
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

      const result = await AdminService.deleteAdminUser(id)

      res.status(200).json({
        status: 'success',
        message: result.message
      })

    } catch (error) {
      next(error)
    }
  }

  static async getAdminOrders(
    req: UserRequest,
    res: Response,
    next: NextFunction
  ) {
    try {

      const page = Number(req.query.page) || 1
      const limit = Number(req.query.limit) || 10

      const result = await AdminService.getAdminOrders(
        req.staff!,
        page,
        limit
      )

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

 static async getAdminOrderDetail(req: UserRequest, res: Response, next: NextFunction) {
  try {

    const orderId = req.params.id as string;

    const result = await AdminService.getAdminOrderDetail(
      req.staff!,
      orderId
    );

    res.status(200).json({
      status: "success",
      message: "Order retrieved successfully",
      data: result
    });

    } catch (error) {
      next(error);
    }
  }

  static async createAdminOrder(
  req: UserRequest,
  res: Response,
  next: NextFunction
  ) {
  try {
    const result = await AdminService.createAdminOrder(
      req.staff!,
      req.body
    );

    res.status(201).json({
      status: "success",
      message: "Order created successfully",
      data: result,
    });
    } catch (error) {
      next(error);
    }
  }

  static async getAdminPickupRequests(
  req: UserRequest,
  res: Response,
  next: NextFunction
  ) {
  try {

    const result = await AdminService.getAdminPickupRequests(
      req.staff!
    )

    res.status(200).json({
      status: "success",
      message: "Pickup requests retrieved successfully",
      data: result
    })

    } catch (error) {
      next(error)
    }
  }
}