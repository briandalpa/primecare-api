export type CreateBypassRequestInput = {
  stationRecordId: string;
  mismatchDetails: string;
};

export type BypassRequestResponse = {
  id: string;
  stationRecordId: string;
  workerId: string;
  adminId: string | null;
  status: string;
  problemDescription: string;

  stationRecord: {
    id: string;
    order: {
      id: string;
      outletId: string;
    };
  };

  worker: {
    id: string;
    name: string;
  };

  admin: {
    id: string;
    name: string;
  } | null;
};

export const toBypassResponse = (bypass: any): BypassRequestResponse => {
  return {
    id: bypass.id,
    stationRecordId: bypass.stationRecordId,
    workerId: bypass.workerId,
    adminId: bypass.adminId,
    status: bypass.status,
    problemDescription: bypass.problemDescription,

    stationRecord: {
      id: bypass.stationRecord.id,
      order: {
        id: bypass.stationRecord.order.id,
        outletId: bypass.stationRecord.order.outletId,
      },
    },

    worker: {
      id: bypass.worker.id,
      name: bypass.worker.name,
    },

    admin: bypass.admin
      ? {
          id: bypass.admin.id,
          name: bypass.admin.name,
        }
      : null,
  };
};