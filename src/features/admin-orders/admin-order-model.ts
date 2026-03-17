export type CreateAdminOrderInput = {
  pickupRequestId: string;
  pricePerKg: number;
  totalWeightKg: number;
  items: { laundryItemId: string; quantity: number }[];
};

export type GetAdminOrdersQuery = {
  page: number;
  limit: number;
  status?: string;
  outletId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};
