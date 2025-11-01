# Fix: Password Change Not Saving

## Problem Identified

When testing the password change feature at `http://localhost:3000/minha-conta#security`, two critical issues occurred:

1. **Session was not terminated** after password change
2. **Password was not saved** - had to login with OLD password, new password was rejected

## Root Cause

The frontend component `SecurityForm.tsx` calls the `usePasswordChange()` hook, which makes a POST request to `/api/account/password` (the OLD endpoint).

The old endpoint at [app/api/account/password/route.ts](../app/api/account/password/route.ts) was just a validation stub that:
- Checked if required fields were present
- Verified passwords matched
- Returned `{ ok: true }` **WITHOUT ACTUALLY SAVING THE PASSWORD TO THE DATABASE**

## Solution

Replaced the entire `/api/account/password/route.ts` endpoint with a complete implementation that:

### 1. Authentication & Rate Limiting
- Validates user session via JWT token
- Enforces rate limiting (5 requests per 15min per IP, 3 per 15min per user)

### 2. Field Mapping (Backward Compatibility)
```typescript
const mappedBody = {
  currentPassword: body.currentPassword,
  newPassword: body.newPassword,
  confirmPassword: body.confirmNewPassword || body.confirmPassword, // Support old field name
};
```

### 3. Password Validation
- Uses Zod schema validation with `changePasswordSchema`
- Validates password policy (8+ chars, uppercase, lowercase, number, special char)
- Blocks common passwords
- Prevents password reuse (checks last 5 passwords)

### 4. Password Change via Service
```typescript
const result = await accountSecurityService.changePassword(userId, input, {
  ip: clientIp,
  userAgent,
});
```

This service:
- Verifies current password with bcrypt
- Hashes new password with 12 salt rounds
- **Increments `tokenVersion`** to invalidate ALL existing sessions globally
- Updates `passwordUpdatedAt` timestamp
- Saves password history (last 5 hashes)
- Logs security event to `user_security_events` table

### 5. Session Termination
```typescript
// Clear server-side cookie
await removeAuthCookie();

// Clear response cookie
response.cookies.set(AUTH_COOKIE_NAME, "", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 0, // Expire immediately
});
```

### 6. Email Notification
```typescript
sendPasswordChangedEmail(user.email, user.name, {
  changedAt: result.passwordUpdatedAt,
  ip: clientIp,
  userAgent,
}).catch((error) => {
  console.error("[change-password] Erro ao enviar e-mail:", error);
});
```

## Expected Behavior After Fix

1. User changes password in `/minha-conta#security`
2. Password is **saved to database** (hashed with bcrypt)
3. `tokenVersion` is **incremented** (e.g., 0 → 1)
4. All existing JWTs with old tokenVersion become **invalid**
5. Cookies are **cleared** on server and client
6. Success message is displayed: "Senha atualizada com sucesso. Redirecionando para o login..."
7. User is **automatically redirected to `/login`** after 1.5 seconds
8. User can **login with NEW password only**
9. Email notification is sent
10. Security event is logged

## Testing

Test the password change functionality:

```bash
# 1. Login to get session cookie
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu-email@example.com",
    "password": "SuaSenhaAtual123!"
  }' \
  -c cookies.txt

# 2. Change password
curl -X POST http://localhost:3000/api/account/password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "currentPassword": "SuaSenhaAtual123!",
    "newPassword": "NovaSenha@2025!",
    "confirmNewPassword": "NovaSenha@2025!"
  }'

# Expected response:
# {
#   "ok": true,
#   "sessionInvalidated": true,
#   "requireReauth": true
# }

# 3. Try to access protected endpoint with old cookie (should fail)
curl http://localhost:3000/api/account/cards -b cookies.txt
# Expected: 401 Unauthorized

# 4. Login with NEW password (should succeed)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu-email@example.com",
    "password": "NovaSenha@2025!"
  }'
# Expected: 200 OK with user data
```

## Files Modified

### Backend
- [app/api/account/password/route.ts](../app/api/account/password/route.ts) - Replaced stub with full implementation

### Frontend
- [components/account/SecurityForm.tsx](../components/account/SecurityForm.tsx) - Added automatic redirect to login after password change
- [src/components/account/SecurityForm.tsx](../src/components/account/SecurityForm.tsx) - Added automatic redirect to login after password change

## Related Documentation

- [docs/API_ACCOUNT_SECURITY.md](./API_ACCOUNT_SECURITY.md) - API documentation
- [docs/AUTH_TOKEN_VERSION.md](./AUTH_TOKEN_VERSION.md) - Token version system
- [docs/SECURITY_TESTING.md](./SECURITY_TESTING.md) - Testing guide
- [lib/services/account-security.service.ts](../lib/services/account-security.service.ts) - Business logic
- [lib/validation/password-policy.ts](../lib/validation/password-policy.ts) - Password validation
- [lib/auth/session.ts](../lib/auth/session.ts) - JWT token management
