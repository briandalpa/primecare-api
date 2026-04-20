import { Response } from 'express';
import { ResponseError } from '@/error/response-error';
import type { UserRequest } from '@/types/user-request';
import type { Staff } from '@/generated/prisma/client';
import {
  WORKER_NOTIFICATION_CONNECTED_EVENT,
  WORKER_NOTIFICATION_PING_EVENT,
  WORKER_NOTIFICATION_PING_MS,
  type WorkerNotificationContext,
  type WorkerNotificationSubscriber,
  toWorkerOrderArrivalPayload,
  toWorkerSubscriber,
} from './worker-notification-model';

interface WorkerConnection {
  subscriber: WorkerNotificationSubscriber;
  response: Response;
  heartbeat: NodeJS.Timeout;
}

const assertWorkerNotificationContext = (staff: Staff) => {
  if (!staff.outletId || !staff.workerType) {
    throw new ResponseError(
      422,
      'Worker station or outlet assignment is not configured',
    );
  }
};

const writeSseEvent = (
  response: Response,
  event: string,
  payload: unknown,
) => {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export class WorkerNotificationService {
  private static connections = new Map<string, WorkerConnection>();

  static async subscribe(staff: Staff, req: UserRequest, res: Response) {
    assertWorkerNotificationContext(staff);

    const subscriber = toWorkerSubscriber(
      staff,
      `${staff.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    writeSseEvent(res, WORKER_NOTIFICATION_CONNECTED_EVENT, {
      station: subscriber.station,
      outletId: subscriber.outletId,
    });

    const heartbeat = setInterval(() => {
      writeSseEvent(res, WORKER_NOTIFICATION_PING_EVENT, {
        timestamp: new Date().toISOString(),
      });
    }, WORKER_NOTIFICATION_PING_MS);

    this.connections.set(subscriber.id, {
      subscriber,
      response: res,
      heartbeat,
    });

    req.on('close', () => this.unsubscribe(subscriber.id));
  }

  static publishOrderArrival(data: WorkerNotificationContext) {
    const payload = toWorkerOrderArrivalPayload(data);
    if (!payload) return;

    this.connections.forEach((connection) => {
      const { subscriber, response } = connection;
      if (subscriber.outletId !== payload.outletId) return;
      if (subscriber.station !== payload.station) return;
      writeSseEvent(response, payload.event, payload);
    });
  }

  static unsubscribe(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    clearInterval(connection.heartbeat);
    connection.response.end();
    this.connections.delete(connectionId);
  }

  static reset() {
    this.connections.forEach((connection) => {
      clearInterval(connection.heartbeat);
      connection.response.end();
    });
    this.connections.clear();
  }
}
