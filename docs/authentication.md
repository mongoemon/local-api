# JWT Authentication Guide

Local API มี 2 วิธีการ authenticate:

1. **JWT Token** (modern) - `POST /auth/login` และ `POST /auth/verify`
2. **Bearer Token** (legacy) - `GET /prep` และ `GET /protected`

## JWT Authentication Flow (Recommended)

### Step 1: Login & Get Token

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"password"}'
```

**Request Body:**
```json
{
  "username": "demo",
  "password": "password"
}
```

**Response (200 OK):**
```json
{
  "message": "login successful",
  "authenticated": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": "24 hours",
  "user": {
    "userId": "user-123",
    "username": "demo"
  }
}
```

### Step 2: Use Token in Requests

```bash
curl -X POST http://localhost:3001/auth/verify \
  -H "Authorization: Bearer <token_from_login>"
```

### Step 3: Verify Token

**Request:**
```bash
curl -X POST http://localhost:3001/auth/verify \
  -H "Authorization: Bearer eyJhbGci..."
```

**Response (200 OK):**
```json
{
  "message": "token is valid",
  "valid": true,
  "decoded": {
    "userId": "user-123",
    "username": "demo",
    "iat": "2026-04-17T04:09:25.000Z",
    "exp": "2026-04-18T04:09:25.000Z"
  }
}
```

**Response (401 Unauthorized) - Missing Token:**
```json
{
  "error": "missing_token",
  "message": "Send Authorization: Bearer <token> or x-access-token header"
}
```

**Response (403 Forbidden) - Invalid Token:**
```json
{
  "error": "invalid_token",
  "message": "Token is not valid"
}
```

**Response (401 Unauthorized) - Expired Token:**
```json
{
  "error": "token_expired",
  "message": "Token has expired",
  "expiredAt": "2026-04-18T04:09:25.000Z"
}
```

## Demo Credentials

| Username | Password | Status |
|----------|----------|--------|
| demo     | password | ✓ Works |
| any other | any     | ✗ Fails |

## Token Details

- **Algorithm:** HS256
- **Payload:** userId, username, iat, exp
- **Expiration:** 24 hours
- **Secret:** Configurable in `config.js` via `auth.jwtSecret`

## Production Notes

- ⚠️ Set `JWT_SECRET` environment variable before production (default is `local-api-jwt-secret`)
- ⚠️ Replace demo credentials with database validation
- ⚠️ Implement proper password hashing (bcrypt/argon2)
- ⚠️ Use HTTPS in production (not HTTP)
- ⚠️ Consider adding refresh token mechanism
- ⚠️ Add rate limiting on `/auth/login` endpoint

## Legacy Bearer Token (GET /prep + GET /protected)

Still supported for backward compatibility:

```bash
# Get token from /prep
curl http://localhost:3001/prep

# Use it in /protected
curl http://localhost:3001/protected \
  -H "Authorization: Bearer lab-token"
```

**Recommended:** Migrate to JWT `/auth/login` flow for new projects
