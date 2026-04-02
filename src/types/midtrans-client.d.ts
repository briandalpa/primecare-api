declare module 'midtrans-client' {
  interface MidtransConfig {
    isProduction: boolean;
    serverKey: string;
    clientKey: string;
  }

  interface TransactionDetails {
    order_id: string;
    gross_amount: number;
  }

  interface SnapTransactionParam {
    transaction_details: TransactionDetails;
    [key: string]: unknown;
  }

  interface SnapTransactionResult {
    token: string;
    redirect_url: string;
  }

  class Snap {
    constructor(config: MidtransConfig);
    createTransaction(param: SnapTransactionParam): Promise<SnapTransactionResult>;
  }

  class CoreApi {
    constructor(config: MidtransConfig);
  }

  export { Snap, CoreApi };
}
