# Auth API Spec

> **Important:** All `/api/auth/*` routes are managed by **better-auth**. They do **not** use the PrimeCare `{ status, message, data }` response envelope — they follow better-auth's own response format. Do not add these routes to Express routers.
>
> Registered in `app.ts` via `app.all('/api/auth/*', toNodeHandler(auth))` before `express.json()`.

> **Customer registration** is handled by the custom Express API at `POST /api/v1/users/register` and `POST /api/v1/users/set-password` — see `docs/users.md`. These routes are NOT managed by better-auth.

---

## POST /api/auth/sign-in/email

Log in with email and password.

**Access:** Public

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (Success — 200):**

```json
{
  "user": {
    "id": "usr_abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": true
  },
  "session": {
    "id": "sess_xyz",
    "expiresAt": "2026-04-06T10:00:00.000Z"
  }
}
```

**Response (Error — 401):**

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

**Notes:**

- Sets a session cookie (`better-auth.session_token`) automatically.
- Unverified users (`emailVerified: false`) are rejected with an appropriate error.
- After login, redirect the user to their originally requested URL (return URL).

---

## POST /api/auth/sign-out

Invalidate the current session and clear the session cookie.

**Access:** Authenticated (any role)

**Request Body:** None

**Response (Success — 200):**

```json
{
  "success": true
}
```

---

## GET /api/auth/session

Retrieve the currently authenticated user and session.

**Access:** Authenticated (any role)

**Response (Success — 200):**

```json
{
  "user": {
    "id": "usr_abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": true
  },
  "session": {
    "id": "sess_xyz",
    "expiresAt": "2026-04-06T10:00:00.000Z"
  }
}
```

> **Note:** The `User` model has no `role` field — roles live on the `Staff` model. To get the authenticated user's role and staff info, call `GET /api/v1/users/me` and read the `staff` object.

**Response (Unauthenticated — 200):**

```json
{
  "user": null,
  "session": null
}
```

---

## GET /api/auth/callback/:provider

OAuth callback URL. Handled entirely by better-auth.

**Access:** Public

**Path Params:**

| Param      | Description                          |
| ---------- | ------------------------------------ |
| `provider` | OAuth provider name (e.g., `google`) |

**Notes:**

- Do not call this endpoint directly, it is the redirect URI registered with OAuth providers.
- better-auth handles token exchange, user creation, and session setup automatically.
