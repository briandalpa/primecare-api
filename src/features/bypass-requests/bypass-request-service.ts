import { prisma } from "../../application/database";
import { ResponseError } from "../../error/response-error";
import { CreateBypassRequestInput, toBypassResponse } from "./bypass-request-model";

export class BypassRequestService {
  static async create(workerId: string, data: CreateBypassRequestInput) {
    return prisma.$transaction(async (tx) => {
      const stationRecord = await tx.stationRecord.findUnique({
        where: { id: data.stationRecordId },
      });

      if (!stationRecord) {
        throw new ResponseError(404, "Station record not found");
      }

      const existing = await tx.bypassRequest.findFirst({
        where: {
          stationRecordId: data.stationRecordId,
          status: "PENDING",
        },
      });

      if (existing) {
        throw new ResponseError(409, "Bypass already requested");
      }

      const bypass = await tx.bypassRequest.create({
        data: {
          stationRecordId: data.stationRecordId,
          workerId: workerId,
          adminId: null,
          status: "PENDING",
          problemDescription: data.mismatchDetails,
        },
      });

      return toBypassResponse(bypass);
    });
  }
}