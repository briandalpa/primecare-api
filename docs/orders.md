# Orders API Spec

Manages laundry orders from creation through completion. All endpoints are under `/api/v1/orders`.

**Auth:** All endpoints require a valid session cookie (`better-auth.session_token`).

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## POST /api/v1/admin/orders

Outlet Admin creates a formal order after laundry physically arrives at the outlet. Advances status from `LAUNDRY_ARRIVED_AT_OUTLET` to `LAUNDRY_BEING_WASHED`.

**Access:** `OUTLET_ADMIN`

**Request Body:**

```json
{
  "pickupRequestId": "pkup_abc123",
  "totalWeightKg": 3.5,
  "pricePerKg": 10000,
  "items": [
    { "laundryItemId": "uuid-tshirt", "quantity": 5 },
    { "laundryItemId": "uuid-trousers", "quantity": 2 },
    { "laundryItemId": "uuid-jacket", "quantity": 1 }
  ]
}
```

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Order created",
  "data": {
    "id": "ord_xyz789",
    "pickupRequestId": "pkup_abc123",
    "outletId": "out_001",
    "staffId": "staff_admin01",
    "totalWeightKg": 3.5,
    "pricePerKg": 10000,
    "totalPrice": 35000,
    "paymentStatus": "UNPAID",
    "status": "LAUNDRY_BEING_WASHED",
    "items": [
      {
        "id": "item_001",
        "laundryItemId": "uuid-tshirt",
        "itemName": "T-Shirt",
        "quantity": 5
      },
      {
        "id": "item_002",
        "laundryItemId": "uuid-trousers",
        "itemName": "Trousers",
        "quantity": 2
      },
      {
        "id": "item_003",
        "laundryItemId": "uuid-jacket",
        "itemName": "Jacket",
        "quantity": 1
      }
    ],
    "createdAt": "2026-03-06T12:00:00.000Z"
  }
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Pickup request not found"
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "An order already exists for this pickup request"
}
```

**Notes:**

- `totalPrice` is calculated server-side: `totalWeightKg × pricePerKg`. Never trust the client's total.
- `pricePerKg` is locked at order creation time and stored on the order record.
- The pickup request must have status `PICKED_UP` and belong to the admin's outlet.
- The customer may pay from the moment this order is created.

---

## GET /api/v1/orders

List orders with server side pagination, filtering, and sorting.

**Access:** `CUSTOMER`

**Query Parameters:**

| Param      | Type   | Default     | Description                                   |
| ---------- | ------ | ----------- | --------------------------------------------- |
| `page`     | number | `1`         | Page number                                   |
| `limit`    | number | `10`        | Items per page                                |
| `status`   | string | —           | Filter by order status enum value             |
| `fromDate` | string | —           | ISO 8601 date; filter `createdAt >= fromDate` |
| `toDate`   | string | —           | ISO 8601 date; filter `createdAt <= toDate`   |
| `search`   | string | —           | Search by order ID or invoice number          |
| `sortBy`   | string | `createdAt` | Sort field (`createdAt`, `totalPrice`)        |
| `order`    | string | `desc`      | `asc` or `desc`                               |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Orders retrieved",
  "data": [
    {
      "id": "ord_xyz789",
      "outletName": "PrimeCare Jakarta Selatan",
      "customerName": "John Doe",
      "totalPrice": 35000,
      "paymentStatus": "UNPAID",
      "status": "LAUNDRY_BEING_WASHED",
      "createdAt": "2026-03-06T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## GET /api/v1/orders/:id

Get full order detail including items, station history, payment, and delivery info.

**Access:** `CUSTOMER` (own order), `OUTLET_ADMIN` (own outlet), `SUPER_ADMIN`, `WORKER`, `DRIVER`

**Path Params:**

| Param | Description |
| ----- | ----------- |
| `id`  | Order UUID  |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Order retrieved",
  "data": {
    "id": "ord_xyz789",
    "outletId": "out_001",
    "outletName": "PrimeCare Jakarta Selatan",
    "customerName": "John Doe",
    "totalWeightKg": 3.5,
    "pricePerKg": 10000,
    "totalPrice": 35000,
    "paymentStatus": "UNPAID",
    "status": "LAUNDRY_BEING_WASHED",
    "confirmedAt": null,
    "createdAt": "2026-03-06T12:00:00.000Z",
    "updatedAt": "2026-03-06T12:30:00.000Z",
    "items": [
      {
        "id": "item_001",
        "laundryItemId": "uuid-tshirt",
        "itemName": "T-Shirt",
        "quantity": 5
      },
      {
        "id": "item_002",
        "laundryItemId": "uuid-trousers",
        "itemName": "Trousers",
        "quantity": 2
      }
    ],
    "stationRecords": [
      {
        "id": "sr_001",
        "station": "WASHING",
        "workerName": "Jane Worker",
        "status": "IN_PROGRESS",
        "completedAt": null,
        "createdAt": "2026-03-06T13:00:00.000Z"
      }
    ],
    "payment": {
      "id": "pay_001",
      "amount": 35000,
      "gateway": "midtrans",
      "status": "PENDING",
      "paidAt": null
    },
    "delivery": null
  }
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Order not found"
}
```

---

## PATCH /api/v1/orders/:id/confirm

Customer manually confirms receipt of their delivered laundry. Sets order status to `COMPLETED`.

**Access:** `CUSTOMER`

**Path Params:**

| Param | Description |
| ----- | ----------- |
| `id`  | Order UUID  |

**Request Body:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Order confirmed as received",
  "data": {
    "id": "ord_xyz789",
    "status": "COMPLETED",
    "confirmedAt": "2026-03-12T10:00:00.000Z"
  }
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Order cannot be confirmed at this stage"
}
```

**Notes:**

- Only valid when `order.status === 'LAUNDRY_DELIVERED_TO_CUSTOMER'`.
- If the customer does not confirm within **2×24 hours**, a background job auto sets `status = 'COMPLETED'` and `confirmedAt = now`.
- A customer cannot confirm an order that already has `status = 'COMPLETED'`.
