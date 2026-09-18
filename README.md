# guard-bucket

Lightweight, dependency-light Express middleware for JWT authentication, token-bucket rate limiting, and role-based access control (RBAC) — no assumptions about your app's data shape, no framework lock-in beyond Express itself.

## Install

```bash
npm install guard-bucket
```

## Why guard-bucket

Most auth/rate-limit middleware either bakes in assumptions about how you store secrets, structure your JWT payload, or identify a client — or pulls in a heavy dependency tree to do it. `guard-bucket` takes the opposite approach: every piece is a small factory function. You pass in exactly the config your app actually uses (a secret string, a function that knows how your user data is shaped, a property name to rate-limit by), and get back a plain Express middleware function. Nothing is assumed on your behalf.

## Middlewares

### `jwtHandler(secret)`

Verifies a JWT from either the `Authorization: Bearer <token>` header or a `cookie` header, and attaches the decoded payload to `req.user`.

```js
const { jwtHandler } = require('guard-bucket');

app.get('/profile', jwtHandler(process.env.JWT_SECRET), (req, res) => {
    res.json({ user: req.user });
});
```

- `secret` — the string used to verify the token's signature. Required. Thrown at setup time (not per-request) if missing or not a string, so a misconfigured route fails immediately on app startup rather than silently on the first real request.
- On success: decoded payload attached to `req.user`, `next()` called.
- On failure: `401 { message: 'MISSING_TOKEN' }` if no token was found, or `401 { message: 'INVALID_TOKEN' }` if verification failed (expired, tampered, or wrong secret).

### `reqRateLimiter(capacity, refillRate, refillIntervals, identifier)`

Per-client rate limiting using the token bucket algorithm — allows short bursts up to `capacity`, then throttles, refilling gradually based on real elapsed time rather than a fixed reset window.

```js
const { reqRateLimiter } = require('guard-bucket');

// 10 requests allowed at once, then 1 more every 2 seconds, keyed by IP
app.post('/login', reqRateLimiter(10, 1, 2000, 'ip'), loginHandler);
```

- `capacity` — max tokens (burst allowance). Required, must be a number.
- `refillRate` — tokens regenerated per interval. Required, must be a number.
- `refillIntervals` — length of that interval, in milliseconds. Required, must be a number.
- `identifier` — the property name to read off `req` to distinguish clients (e.g. `'ip'` for `req.ip`). Required, must be a string.
- On success: 1 token consumed, `next()` called.
- On failure: `429 { message: 'TOO_MANY_REQUESTS' }`.

Bucket state is kept in memory, per process — fine for a single-instance app or light protection on sensitive routes; for multi-instance deployments behind a load balancer, pair it with a shared store (not provided by this package) if you need consistent limits across instances.

### `rbacConfig(acceptableRoleList, getRole)`

Role-based access control. Runs **after** `jwtHandler` in the middleware chain, since it depends on `req.user` already being populated.

```js
const { jwtHandler, rbacConfig } = require('guard-bucket');

app.delete(
    '/users/:id',
    jwtHandler(process.env.JWT_SECRET),
    rbacConfig(['admin'], (req) => req.user.role),
    deleteUserHandler
);
```

- `acceptableRoleList` — array of roles allowed to proceed. Required, must be an array.
- `getRole` — a function `(req) => role`, given full control over how the current request's role is determined. `guard-bucket` never assumes your JWT payload's shape — you tell it exactly where to look (`req.user.role`, `req.user.permissions[0]`, whatever your app actually uses). Required, must be a function.
- On success: `next()` called.
- On failure: `403 { message: 'REQUEST_VIA_INVALID_ROLE' }`.

## Composing them

All three are plain Express middleware, so they chain like any other:

```js
const express = require('express');
const { jwtHandler, reqRateLimiter, rbacConfig } = require('guard-bucket');

const app = express();
const SECRET = process.env.JWT_SECRET;

app.post(
    '/admin/broadcast',
    reqRateLimiter(5, 1, 2000, 'ip'),
    jwtHandler(SECRET),
    rbacConfig(['admin'], (req) => req.user.role),
    broadcastHandler
);
```

## License

ISC
