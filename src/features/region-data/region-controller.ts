import { Request, Response, NextFunction } from 'express';
import { Validation } from '@/validations/validation';
import { RegionValidation } from '@/validations/region-validation';
import { RegionService } from './region-service';

export class RegionController {
  static async listProvinces(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await RegionService.getProvinces();
      res.status(200).json({ status: 'success', message: 'Provinces retrieved', data });
    } catch (error) {
      next(error);
    }
  }

  static async listCities(req: Request, res: Response, next: NextFunction) {
    try {
      const { provinceId } = Validation.validate(RegionValidation.GET_CITIES, req.params);
      const data = await RegionService.getCities(provinceId);
      res.status(200).json({ status: 'success', message: 'Cities retrieved', data });
    } catch (error) {
      next(error);
    }
  }

  static async geocode(req: Request, res: Response, next: NextFunction) {
    try {
      const { city, province } = Validation.validate(RegionValidation.GEOCODE, req.query);
      const data = await RegionService.geocode(city, province);
      res.status(200).json({ status: 'success', message: 'Geocode successful', data });
    } catch (error) {
      next(error);
    }
  }
}
