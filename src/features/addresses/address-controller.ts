import { Validation } from '@/validations/validation';
import { AddressValidation } from '@/validations/address-validation';
import { NextFunction, Response } from 'express';
import { UserRequest } from '@/types/user-request';
import { AddressService } from './address-service';

export class AddressController {
  static async list(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const data = await AddressService.listAddresses(req.user!.id);
      res.status(200).json({ status: 'success', message: 'Addresses retrieved', data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const input = Validation.validate(AddressValidation.CREATE, req.body);
      const data = await AddressService.createAddress(req.user!.id, input);
      res.status(201).json({ status: 'success', message: 'Address created', data });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const input = Validation.validate(AddressValidation.UPDATE, req.body);
      const data = await AddressService.updateAddress(req.user!.id, req.params.id as string, input);
      res.status(200).json({ status: 'success', message: 'Address updated', data });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: UserRequest, res: Response, next: NextFunction) {
    try {
      await AddressService.deleteAddress(req.user!.id, req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async setPrimary(req: UserRequest, res: Response, next: NextFunction) {
    try {
      const data = await AddressService.setPrimary(req.user!.id, req.params.id as string);
      res.status(200).json({ status: 'success', message: 'Primary address updated', data });
    } catch (error) {
      next(error);
    }
  }
}
