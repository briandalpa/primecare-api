# Auth API Spec

> **Important:** All `/api/auth/*` routes are managed by **better-auth**. They do **not** use the PrimeCare `{ status, message, data }` response envelope — they follow better-auth's own response format. Do not add these routes to Express routers.
>
> Registered in `app.ts` via `app.all('/api/auth/*', toNodeHandler(auth))` before `express.json()`.

---

## POST /api/auth/sign-up/email

Register a new customer account. No password is set at this step — a verification email is sent instead.

**Access:** Public

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response (Success — 200):**

```json
{
  "user": {
    "id": "usr_abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": false,
    "createdAt": "2026-03-06T10:00:00.000Z"
  }
}
```

**Response (Error — 422):**

```json
{
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "Email already registered"
  }
}
```

**Notes:**
- better-auth sends a verification email automatically after sign-up.
- The verification link expires **1 hour** after being issued.
- Newly registered users have `emailVerified: false` and cannot create orders until verified.

---

## GET /api/auth/verify-email

Verify the customer's email address and set their password. The token is embedded in the link sent via email.

**Access:** Public

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | One-time verification token from the email link |

**Notes:**
- Token is single-use and expires 1 hour after generation.
- After successful verification, `emailVerified` is set to `true`.
- Redirect the user to the login page on success.
- If the token is expired or invalid, prompt the user to request a new link.

---

## POST /api/auth/send-verification-email

Resend the email verification link to the user's registered email.

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
  "status": true
}
```

**Notes:**
- Invalidates any previously issued verification tokens for this email.
- New token also expires 1 hour after issue.

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
    "emailVerified": true,
    "role": "CUSTOMER"
  },
  "session": {
    "id": "sess_xyz",
    "expiresAt": "2026-04-06T10:00:00.000Z"
  }
}
```

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

| Param | Description |
|-------|-------------|
| `provider` | OAuth provider name (e.g., `google`) |

**Notes:**
- Do not call this endpoint directly — it is the redirect URI registered with OAuth providers.
- better-auth handles token exchange, user creation, and session setup automatically.
