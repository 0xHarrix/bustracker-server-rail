# Test trip boarding (manual curl / Postman)

Use these after seeding (`npm run seed`). Replace `ADMIN_TOKEN`, `DRIVER_TOKEN`, and `PARENT_ID` with values from earlier responses. Base URL: `http://localhost:4000`.

## 1. Get admin token

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"schoolCode":"DPS01","identifier":"+919999900000","password":"admin123"}'
```

Copy `data.token` → use as `ADMIN_TOKEN`.

## 2. Get parent user IDs (for board calls)

```bash
curl -s http://localhost:4000/api/users \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

Pick one or more `_id` from users with `"role":"parent"` and `busId` set → use as `PARENT_ID`.

## 3. Get driver token

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"schoolCode":"DPS01","identifier":"+919800000001","password":"driver123"}'
```

Copy `data.token` → use as `DRIVER_TOKEN`.

## 4. Start trip (driver)

```bash
curl -s -X POST http://localhost:4000/api/trips/start \
  -H "Authorization: Bearer DRIVER_TOKEN" \
  -H "Content-Type: application/json"
```

## 5. Board one student (driver)

```bash
curl -s -X POST http://localhost:4000/api/trips/current/board \
  -H "Authorization: Bearer DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"PARENT_ID"}'
```

## 6. Board multiple students (driver)

```bash
curl -s -X POST http://localhost:4000/api/trips/current/board \
  -H "Authorization: Bearer DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentIds":["PARENT_ID_1","PARENT_ID_2"]}'
```

## 7. Unboard one student (driver)

```bash
curl -s -X POST http://localhost:4000/api/trips/current/unboard \
  -H "Authorization: Bearer DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"PARENT_ID"}'
```

## 8. End trip (driver)

```bash
curl -s -X POST http://localhost:4000/api/trips/end \
  -H "Authorization: Bearer DRIVER_TOKEN" \
  -H "Content-Type: application/json"
```

## Parent: get current trip

```bash
curl -s http://localhost:4000/api/trips/current \
  -H "Authorization: Bearer PARENT_TOKEN"
```

(Get `PARENT_TOKEN` by logging in as a parent, e.g. identifier `2024-A-101`, password `parent123`, schoolCode `DPS01`.)
