export type CreateShiftInput = {
  staffId: string;
  startedAt: string;
};

export type ShiftListQuery = {
  page: number;
  limit: number;
  staffId?: string;
  outletId?: string;
  isActive?: boolean;
};

export type ShiftResponse = {
  id: string;
  staffId: string;
  workerType: string | null;
  workerName: string | null;
  outletId: string;
  outletName: string;
  startedAt: Date;
  endedAt: Date | null;
  isActive: boolean;
};