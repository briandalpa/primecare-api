import { EventEmitter } from 'events';
import { WorkerNotificationService } from '@/features/worker-notifications/worker-notification-service';
import {
  WORKER_NOTIFICATION_CONNECTED_EVENT,
  WORKER_ORDER_ARRIVED_EVENT,
} from '@/features/worker-notifications/worker-notification-model';

const createResponse = () => ({
  end: jest.fn(),
  setHeader: jest.fn(),
  flushHeaders: jest.fn(),
  write: jest.fn(),
});

describe('WorkerNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    WorkerNotificationService.reset();
  });

  it('throws 422 when worker station or outlet is missing', async () => {
    const request = new EventEmitter() as any;
    const response = createResponse() as any;

    await expect(
      WorkerNotificationService.subscribe(
        {
          id: 'staff-1',
          outletId: null,
          workerType: null,
        } as any,
        request,
        response,
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('subscribes a worker and writes an initial connected event', async () => {
    const request = new EventEmitter() as any;
    const response = createResponse() as any;

    await WorkerNotificationService.subscribe(
      {
        id: 'staff-1',
        outletId: 'outlet-1',
        workerType: 'WASHING',
      } as any,
      request,
      response,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream',
    );
    expect(response.write).toHaveBeenNthCalledWith(
      1,
      `event: ${WORKER_NOTIFICATION_CONNECTED_EVENT}\n`,
    );
  });

  it('publishes arrival events only to the matching outlet and station', async () => {
    const washingRequest = new EventEmitter() as any;
    const ironingRequest = new EventEmitter() as any;
    const washingResponse = createResponse() as any;
    const ironingResponse = createResponse() as any;

    await WorkerNotificationService.subscribe(
      {
        id: 'staff-washing',
        outletId: 'outlet-1',
        workerType: 'WASHING',
      } as any,
      washingRequest,
      washingResponse,
    );
    await WorkerNotificationService.subscribe(
      {
        id: 'staff-ironing',
        outletId: 'outlet-1',
        workerType: 'IRONING',
      } as any,
      ironingRequest,
      ironingResponse,
    );

    washingResponse.write.mockClear();
    ironingResponse.write.mockClear();

    WorkerNotificationService.publishOrderArrival({
      orderId: 'order-1',
      outletId: 'outlet-1',
      orderStatus: 'LAUNDRY_BEING_WASHED',
    });

    expect(washingResponse.write).toHaveBeenNthCalledWith(
      1,
      `event: ${WORKER_ORDER_ARRIVED_EVENT}\n`,
    );
    expect(ironingResponse.write).not.toHaveBeenCalled();
  });

  it('cleans up the connection when the request closes', async () => {
    const request = new EventEmitter() as any;
    const response = createResponse() as any;

    await WorkerNotificationService.subscribe(
      {
        id: 'staff-1',
        outletId: 'outlet-1',
        workerType: 'WASHING',
      } as any,
      request,
      response,
    );

    request.emit('close');

    expect(response.end).toHaveBeenCalled();
  });
});
