# Users API Spec

## Public Endpoints (No Auth Required)

These endpoints do not require a session cookie. They handle customer self-registration.

---

## POST /api/v1/users/register

Register a new customer account. No password is set at this step — a set-password email is sent instead.

**Access:** Public

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Registration successful. Check your email to set your password.",
  "data": {
    "id": "usr_abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": false
  }
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Email already registered"
}
```

**Notes:**

- A set-password link is emailed immediately after registration. The link expires **1 hour** after issue.
- The user cannot sign in until they complete `POST /api/v1/users/set-password`.
- Newly registered users have `emailVerified: false`.

---

## POST /api/v1/users/set-password

Set the account password using the token from the registration email. Marks the account as verified.

**Access:** Public

**Request Body:**

```json
{
  "token": "uuid-token-from-email",
  "password": "SecurePass123!"
}
```

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Password set successfully"
}
```

**Response (Error — 400):**

```json
{
  "status": "error",
  "message": "Invalid or expired token"
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Password already set"
}
```

**Notes:**

- `password` must be at least 8 characters.
- Token is single-use and expires 1 hour after registration.
- On success, `emailVerified` is set to `true` and the user may sign in via `POST /api/auth/sign-in/email`.

---

## POST /api/v1/users/resend-verification

Resend the set-password email if the previous link has expired.

**Access:** Public

**Request Body:**

```json
{
  "email": "john@example.com"
}
```

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Verification email sent"
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Account already verified"
}
```

**Notes:**

- Always returns 200 even if the email is not registered (prevents email enumeration).
- If the account is already verified (password already set), returns 409.
- Invalidates any previously issued token and issues a new one (expires 1 hour).

---

## Authenticated Endpoints

**Auth:** All endpoints require a valid session cookie (`better-auth.session_token`).

**Response Envelope:**

```json
{ "status": "success" | "error", "message": "...", "data": { ... } | null }
```

---

## GET /api/v1/users/me

Get the currently authenticated user's profile.

**Access:** Any authenticated role

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Profile retrieved",
  "data": {
    "id": "usr_abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": true,
    "image": null,
    "avatarUrl": "https://example.com/avatar.jpg",
    "phone": null,
    "createdAt": "2026-03-06T10:00:00.000Z",
    "staff": null
  }
}
```

> `staff` is `null` for customers. For staff members it contains: `{ id, role, workerType, outletId, isActive }`. Use this field to determine the user's role and permissions on the frontend.

---

## PATCH /api/v1/users/me

> ⚠️ Not yet implemented

Update the authenticated user's own profile.

**Access:** Any authenticated role

**Request Body:**

```json
{
  "name": "John Doe Updated",
  "phone": "+6281234567890",
  "avatarUrl": "https://example.com/new-avatar.jpg"
}
```

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Profile updated",
  "data": {
    "id": "usr_abc123",
    "name": "John Doe Updated",
    "phone": "+6281234567890",
    "email": "john@example.com",
    "avatarUrl": "https://example.com/new-avatar.jpg",
    "updatedAt": "2026-03-06T11:00:00.000Z"
  }
}
```

**Notes:**

- Avatar upload must be `jpg`, `png`, or `webp`; max 2 MB.
- Email cannot be changed via this endpoint.
- Role and staff-related fields cannot be changed via this endpoint — use `PATCH /api/v1/admin/users/:id` (SUPER_ADMIN only).

---

## GET /api/v1/admin/users

List all users. Scoped by role:

- **SUPER_ADMIN:** All users across all outlets, including customers (users without a Staff record).
- **OUTLET_ADMIN:** Only staff users belonging to their own outlet.

**Access:** `OUTLET_ADMIN`, `SUPER_ADMIN`

**Query Parameters:**

| Param      | Type   | Default     | Description                                        |
| ---------- | ------ | ----------- | -------------------------------------------------- |
| `page`     | number | `1`         | Page number                                        |
| `limit`    | number | `10`        | Items per page                                     |
| `search`   | string | —           | Search by name or email                            |
| `role`     | string | —           | Filter by role: `OUTLET_ADMIN`, `WORKER`, `DRIVER` |
| `outletId` | string | —           | Filter by outlet (SUPER_ADMIN only)                |
| `sortBy`   | string | `createdAt` | Sort field                                         |
| `order`    | string | `desc`      | `asc` or `desc`                                    |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Users retrieved",
  "data": [
    {
      "id": "usr_def456",
      "name": "Jane Worker",
      "email": "jane@primecare.com",
      "emailVerified": true,
      "role": "WORKER",
      "workerType": "WASHING",
      "outletId": "out_001",
      "isActive": true,
      "createdAt": "2026-03-01T08:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

## POST /api/v1/admin/users

Create a new staff user account. Sends an invitation email for password setup.

**Access:** `SUPER_ADMIN`

**Request Body:**

```json
{
  "name": "New Driver",
  "email": "driver@primecare.com",
  "role": "DRIVER",
  "workerType": null,
  "outletId": "out_001"
}
```

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "User created and invitation email sent",
  "data": {
    "id": "usr_new789",
    "name": "New Driver",
    "email": "driver@primecare.com",
    "emailVerified": false,
    "role": "DRIVER",
    "workerType": null,
    "outletId": "out_001",
    "isActive": true,
    "createdAt": "2026-03-06T10:00:00.000Z"
  }
}
```

**Response (Error — 409):**

```json
{
  "status": "error",
  "message": "Email already registered"
}
```

**Notes:**

- `workerType` is required when `role` is `WORKER` (`WASHING`, `IRONING`, or `PACKING`).
- The invitation email contains a one-time password setup link (expires 1 hour).

---

## GET /api/v1/admin/users/:id

> ⚠️ Not yet implemented

Get a specific user by ID.

**Access:** `OUTLET_ADMIN` (own outlet only), `SUPER_ADMIN`

**Path Params:**

| Param | Description |
| ----- | ----------- |
| `id`  | User UUID   |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "User retrieved",
  "data": {
    "id": "usr_def456",
    "name": "Jane Worker",
    "email": "jane@primecare.com",
    "emailVerified": true,
    "role": "WORKER",
    "workerType": "WASHING",
    "outletId": "out_001",
    "isActive": true,
    "createdAt": "2026-03-01T08:00:00.000Z"
  }
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "User not found"
}
```

---

## PATCH /api/v1/admin/users/:id

Update a staff user's details.

**Access:** `SUPER_ADMIN`

**Path Params:**

| Param | Description |
| ----- | ----------- |
| `id`  | User UUID   |

**Request Body:**

```json
{
  "name": "Jane Worker Updated",
  "workerType": "IRONING",
  "isActive": false
}
```

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "User updated",
  "data": {
    "id": "usr_def456",
    "name": "Jane Worker Updated",
    "workerType": "IRONING",
    "isActive": false,
    "updatedAt": "2026-03-06T12:00:00.000Z"
  }
}
```

---

## DELETE /api/v1/admin/users/:id

Delete a staff user account.

**Access:** `SUPER_ADMIN`

**Path Params:**

| Param | Description |
| ----- | ----------- |
| `id`  | User UUID   |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "User deleted",
  "data": null
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "User not found"
}
```

**Notes:**

- Always require confirmation in the UI before calling this endpoint.
- Cannot delete your own account via this endpoint.

---

## GET /api/v1/users/addresses

List all saved addresses of the authenticated customer.

**Access:** `CUSTOMER`

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Addresses retrieved",
  "data": [
    {
      "id": "addr_001",
      "label": "Home",
      "street": "Jl. Sudirman No. 1",
      "city": "Jakarta",
      "province": "DKI Jakarta",
      "latitude": -6.2088,
      "longitude": 106.8456,
      "phone": "081234567890",
      "isPrimary": true,
      "createdAt": "2026-03-01T08:00:00.000Z"
    },
    {
      "id": "addr_002",
      "label": "Office",
      "street": "Jl. Thamrin No. 10",
      "city": "Jakarta",
      "province": "DKI Jakarta",
      "latitude": -6.1944,
      "longitude": 106.8229,
      "phone": "081298765432",
      "isPrimary": false,
      "createdAt": "2026-03-02T08:00:00.000Z"
    }
  ]
}
```

---

## POST /api/v1/users/addresses

Add a new saved address.

**Access:** `CUSTOMER`

**Request Body:**

```json
{
  "label": "Home",
  "street": "Jl. Sudirman No. 1",
  "city": "Jakarta",
  "province": "DKI Jakarta",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "phone": "081234567890"
}
```

**Response (Success — 201):**

```json
{
  "status": "success",
  "message": "Address created",
  "data": {
    "id": "addr_003",
    "label": "Home",
    "street": "Jl. Sudirman No. 1",
    "city": "Jakarta",
    "province": "DKI Jakarta",
    "latitude": -6.2088,
    "longitude": 106.8456,
    "phone": "081234567890",
    "isPrimary": true,
    "createdAt": "2026-03-06T10:00:00.000Z"
  }
}
```

**Notes:**

- `latitude` and `longitude` are required. Use OpenCage or RajaOngkir on the frontend to populate coordinates from city/province.
- If `isPrimary: true`, all other addresses for this user are automatically set to `isPrimary: false`.

---

## PATCH /api/v1/users/addresses/:id

Update a saved address.

**Access:** `CUSTOMER`

**Path Params:**

| Param | Description  |
| ----- | ------------ |
| `id`  | Address UUID |

**Request Body:**

```json
{
  "label": "Home Updated",
  "street": "Jl. Sudirman No. 2",
  "city": "Jakarta",
  "province": "DKI Jakarta",
  "latitude": -6.209,
  "longitude": 106.846,
  "phone": "081298765432"
}
```

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Address updated",
  "data": {
    "id": "addr_001",
    "label": "Home Updated",
    "street": "Jl. Sudirman No. 2",
    "city": "Jakarta",
    "province": "DKI Jakarta",
    "latitude": -6.209,
    "longitude": 106.846,
    "phone": "081298765432",
    "isPrimary": true
  }
}
```

**Response (Error — 404):**

```json
{
  "status": "error",
  "message": "Address not found"
}
```

---

## DELETE /api/v1/users/addresses/:id

Delete a saved address.

**Access:** `CUSTOMER`

**Path Params:**

| Param | Description  |
| ----- | ------------ |
| `id`  | Address UUID |

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Address deleted",
  "data": null
}
```

**Notes:**

- If the deleted address was the primary address and other addresses exist, prompt the user to designate a new primary address (or handle automatically by selecting the most recently created one).

---

## PATCH /api/v1/users/addresses/:id/primary

Set an address as the primary address. Clears `isPrimary` on all other addresses for this user.

**Access:** `CUSTOMER`

**Path Params:**

| Param | Description  |
| ----- | ------------ |
| `id`  | Address UUID |

**Request Body:** None

**Response (Success — 200):**

```json
{
  "status": "success",
  "message": "Primary address updated",
  "data": {
    "id": "addr_002",
    "label": "Office",
    "isPrimary": true
  }
}
```
