# Payments API Spec

Manages payment initiation and Midtrans webhook processing.

**Auth:**
- `POST /api/v1/orders/:id/payments` — requires session (CUSTOMER only)
- `POST /api/v1/payments/webhook` — **public**, no auth (Midtrans server-to-server)

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## POST /api/v1/orders/:id/payments

Initiate payment for an order. Creates a Midtrans transaction server-side and returns a Snap token for the frontend to open the payment popup.

**Access:** `CUSTOMER`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Order UUID |

**Request Body:** None

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Payment initiated",
  "data": {
    "paymentId": "pay_001",
    "orderId": "ord_xyz789",
    "amount": 35000,
    "snapToken": "abc123snaptoken",
    "redirectUrl": "https://app.sandbox.midtrans.com/snap/v2/vtweb/abc123snaptoken"
  }
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Order has already been paid"
}
```

**Response (Error — 403):**

```json
{
  "status": "error",
  "message": "You are not authorized to pay for this order"
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Order not found"
}
```

**Notes:**
- The Midtrans **server key** is used only server-side and is **never** sent to the frontend.
- A `Payment` record is created with `status: 'PENDING'` when this endpoint is called.
- If a `PENDING` payment record already exists for this order, return the existing `snapToken` instead of creating a new one (idempotent).
- If `order.paymentStatus === 'PAID'`, return `409`.
- The customer can pay from the moment the order is created until packing is complete.

---

## POST /api/v1/orders/:id/payments/verify

Customer manually triggers a payment status check against Midtrans. Useful after a redirect-back if the webhook has not yet fired.

**Access:** `CUSTOMER`

**Path Params:**

| Param | Description |
|-------|-------------|
| `id`  | Order UUID  |

**Request Body:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Payment verified",
  "data": null
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Order not found"
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Order has already been paid"
}
```

**Notes:**
- Polls Midtrans transaction status server-side and applies the same settlement/expire/cancel logic as the webhook handler.
- Idempotent: safe to call repeatedly.

---

## POST /api/v1/payments/webhook

Midtrans payment status webhook. This endpoint is **public** (no auth middleware) — Midtrans calls it directly after a payment event.

**Access:** Public (Midtrans server only)

**Request Body (from Midtrans):**

```json
{
  "order_id": "pay_001",
  "transaction_status": "settlement",
  "fraud_status": "accept",
  "gross_amount": "35000.00",
  "signature_key": "abc123sigkey"
}
```

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Webhook processed",
  "data": null
}
```

**Notes — Server-side logic per `transaction_status`:**

| Midtrans Status | Action |
|----------------|--------|
| `settlement` | Set `Payment.status = 'PAID'`, `Payment.paidAt = now`, `Order.paymentStatus = 'PAID'`. If `Order.status === 'WAITING_FOR_PAYMENT'` → set `Order.status = 'LAUNDRY_READY_FOR_DELIVERY'` and create a `Delivery` record with `status: 'PENDING'`. |
| `pending` | No action (already `PENDING`). |
| `expire` | Set `Payment.status = 'EXPIRED'`. |
| `cancel` | Set `Payment.status = 'FAILED'`. |
| `deny` | Set `Payment.status = 'FAILED'`. |

**Security:**
- Always verify the `signature_key` from Midtrans before processing:
  ```
  SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
  ```
- Reject requests with invalid signatures with `400 Bad Request`.
- Never expose `MIDTRANS_SERVER_KEY` in logs or responses.
