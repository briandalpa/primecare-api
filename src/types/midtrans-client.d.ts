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
    createTransaction(
      param: SnapTransactionParam,
    ): Promise<SnapTransactionResult>;
  }

  interface TransactionStatusResponse {
    transaction_status: string;
    fraud_status?: string;
  }

  class CoreApi {
    constructor(config: MidtransConfig);
    transaction: {
      status(transactionId: string): Promise<TransactionStatusResponse>;
    };
  }

  export { Snap, CoreApi };
}
