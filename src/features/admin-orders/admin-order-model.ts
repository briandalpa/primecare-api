export type CreateAdminOrderInput = {
  pickupRequestId: string;
  pricePerKg: number;
  totalWeightKg: number;
  items: { laundryItemId: string; quantity: number }[];
  manualItems?: { name: string; quantity: number; unitPrice: number }[];
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

export type LaundryItemResponse = {
  id: string;
  name: string;
  slug: string;
};
