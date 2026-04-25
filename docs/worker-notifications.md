# Worker Notifications API Spec

Server-Sent Events (SSE) stream for real-time order arrival notifications to workers. The server pushes events when an order arrives at the worker's station.

**Auth:** Requires `requireStaffRole('WORKER')`.

---

## GET /api/v1/worker/notifications/stream

Opens a persistent SSE connection. The server sends events scoped to the worker's outlet and station (`Staff.outletId` and `Staff.workerType`).

**Access:** `WORKER`

**Query Parameters:** None

**Response: `text/event-stream`**

The response is a long-lived stream. Each event is a JSON payload sent as `data: <json>\n\n`.

---

### Event: Connection Established

Sent immediately upon successful connection.

```
data: {"event":"worker-notification-connected","subscriberId":"sub_abc123"}
```

---

### Event: Order Arrived at Station

Sent when a new order reaches the worker's station.

```
data: {
  "event": "worker-order-arrived",
  "orderId": "ord_xyz789",
  "outletId": "out_001",
  "station": "WASHING",
  "orderStatus": "LAUNDRY_BEING_WASHED",
  "occurredAt": "2026-04-25T08:00:00.000Z"
}
```

**Station → orderStatus mapping:**

| Station  | orderStatus              |
| -------- | ------------------------ |
| WASHING  | LAUNDRY_BEING_WASHED     |
| IRONING  | LAUNDRY_BEING_IRONED     |
| PACKING  | LAUNDRY_BEING_PACKED     |

---

### Event: Keep-Alive Ping

Sent every 25 seconds to prevent proxy/load-balancer timeouts.

```
data: {"event":"worker-notification-ping"}
```

---

**Notes:**

- The `EventSource` API in browsers reconnects automatically on connection drop.
- Subscription is scoped to the authenticated worker's `outletId` and `workerType` — workers only receive events for their station and outlet.
- After receiving `worker-order-arrived`, the worker app should call `GET /api/v1/worker/orders` to refresh the queue.
