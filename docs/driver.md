# Driver API Spec

Driver-specific utility endpoints.

**Auth:** All endpoints require `requireStaffRole('DRIVER')`.

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## GET /api/v1/drivers/me/active-task

Returns the driver's currently active task (an accepted pickup or an accepted/in-progress delivery), or `null` if the driver has no active task.

**Access:** `DRIVER`

**Query Parameters:** None

**Response (Success — 200, active pickup task):**

```json
{
  "status": "success",
  "message": "Active task retrieved",
  "data": {
    "type": "pickup",
    "id": "pkup_abc123",
    "customerName": "John Doe",
    "customerPhone": "081234567890",
    "address": {
      "label": "Home",
      "street": "Jl. Sudirman No. 1",
      "city": "Jakarta"
    }
  }
}
```

**Response (Success — 200, active delivery task):**

```json
{
  "status": "success",
  "message": "Active task retrieved",
  "data": {
    "type": "delivery",
    "id": "del_001",
    "customerName": "John Doe",
    "customerPhone": "081234567890",
    "address": {
      "label": "Home",
      "street": "Jl. Sudirman No. 1",
      "city": "Jakarta",
      "province": "DKI Jakarta",
      "phone": "081234567890"
    }
  }
}
```

**Response (Success — 200, no active task):**

```json
{
  "status": "success",
  "message": "No active task",
  "data": null
}
```

**Notes:**

- A driver has an active task when:
  - `PickupRequest` where `driverId = driver.id` AND `status = 'DRIVER_ASSIGNED'`
  - `Delivery` where `driverId = driver.id` AND `status IN ['DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY']`
- Pickup address shape does not include `province` or `phone`. Delivery address includes both.
- `customerPhone` falls back to the customer's `User.phone` if the address has no phone.
- Use this endpoint on driver app startup to resume an interrupted session.
