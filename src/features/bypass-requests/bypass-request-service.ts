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

      if (stationRecord.staffId !== workerId) {
        throw new ResponseError(403, "You are not assigned to this station");
      }

      if (!data.mismatchDetails) {
        throw new ResponseError(400, "Mismatch details required");
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
          problemDescription: null, // ✅ FIX
        },
      });

      // ✅ update status sesuai reviewer
      await tx.stationRecord.update({
        where: { id: data.stationRecordId },
        data: {
          status: "BYPASS_REQUESTED",
        },
      });

      return toBypassResponse(bypass);
    });
  }
}