# School Bus Tracker - API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:4000` (development)  
**Protocol:** HTTP/1.1, WebSocket (Socket.IO)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [REST API Endpoints](#rest-api-endpoints)
6. [Real-Time Events (Socket.IO)](#real-time-events-socketio)
7. [Data Models](#data-models)
8. [Multi-School Isolation](#multi-school-isolation)
9. [Role-Based Access Control](#role-based-access-control)

---

## Overview

This backend provides a complete school bus tracking system with:

- **Multi-school support** - Complete data isolation per school
- **Three user roles**: Admin, Driver, Parent
- **Bus management** - Create buses, assign drivers, manage capacity
- **Trip lifecycle** - Start/end trips, per-stop boarding
- **Real-time GPS tracking** - Live location updates via Socket.IO
- **Student assignment** - Assign students to permanent bus routes

---

## Authentication

### Login

**POST** `/api/auth/login`

**Request Body:**
```json
{
  "schoolCode": "DPS01",
  "identifier": "+919876543210",  // phone OR rollNumber
  "password": "parent123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "674abc123...",
      "name": "Ravi Kumar",
      "role": "parent",
      "phone": "+919876543210",
      "rollNumber": "2024-A-101",
      "schoolId": "674abc456...",
      "busId": "674abc789...",        // Permanent route
      "currentBusId": null             // Currently boarded (null if not on trip)
    }
  }
}
```

**JWT Token:**
- Include in all protected requests: `Authorization: Bearer <token>`
- Expires: 7 days
- Payload: `{ userId, role, schoolId, busId }`

### Get Current User

**GET** `/api/auth/me`  
**Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "674abc123...",
    "name": "Ravi Kumar",
    "role": "parent",
    "phone": "+919876543210",
    "rollNumber": "2024-A-101",
    "schoolId": { "_id": "...", "name": "Delhi Public School", "schoolCode": "DPS01" },
    "busId": "674abc789...",
    "currentBusId": null,
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

## Response Format

All API responses follow this structure:

**Success:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description"
}
```

**Validation Error:**
```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": ["Field is required", "Invalid format"]
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (wrong role) |
| 404 | Not Found |
| 409 | Conflict (duplicate entry) |
| 500 | Internal Server Error |

### Common Error Messages

- `"Authentication required. Please provide a valid token."` - Missing/invalid JWT
- `"Access denied. Required role(s): admin."` - Wrong role
- `"User not found in your school."` - Cross-school access attempt
- `"Token has expired. Please login again."` - JWT expired

---

## REST API Endpoints

### Health Check

**GET** `/health`  
**Auth:** None

**Response:**
```json
{
  "status": "OK",
  "time": "2024-01-15T10:00:00.000Z"
}
```

---

### Schools

All school endpoints require **Admin** role.

#### Create School

**POST** `/api/schools`  
**Auth:** Admin

**Request:**
```json
{
  "name": "Delhi Public School",
  "schoolCode": "DPS01"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "School created successfully.",
  "data": {
    "_id": "674abc123...",
    "name": "Delhi Public School",
    "schoolCode": "DPS01",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### List Schools

**GET** `/api/schools`  
**Auth:** Admin

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Delhi Public School",
      "schoolCode": "DPS01",
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

#### Get School by ID

**GET** `/api/schools/:id`  
**Auth:** Admin

---

### Users

All user endpoints require **Admin** role and are scoped to the admin's school.

#### Create User

**POST** `/api/users`  
**Auth:** Admin

**Request:**
```json
{
  "name": "Ravi Kumar",
  "phone": "+919876543210",
  "rollNumber": "2024-A-101",
  "password": "parent123",
  "role": "parent",              // "admin" | "driver" | "parent"
  "schoolId": "674abc456...",
  "busId": "674abc789..."        // Optional: assign to bus immediately
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User created successfully.",
  "data": {
    "_id": "...",
    "name": "Ravi Kumar",
    "phone": "+919876543210",
    "rollNumber": "2024-A-101",
    "role": "parent",
    "schoolId": "...",
    "busId": "...",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Notes:**
- Parents must have at least `phone` OR `rollNumber`
- `phone` and `rollNumber` must be unique within the school
- `password` is optional (for OTP-only users)

#### List Users

**GET** `/api/users?role=parent`  
**Auth:** Admin  
**Query Params:** `role` (optional: "admin" | "driver" | "parent")

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Ravi Kumar",
      "phone": "+919876543210",
      "rollNumber": "2024-A-101",
      "role": "parent",
      "schoolId": "...",
      "busId": "...",
      "isActive": true
    }
  ]
}
```

#### Get User by ID

**GET** `/api/users/:id`  
**Auth:** Admin

#### Assign User to Bus

**PATCH** `/api/users/:id/assign-bus`  
**Auth:** Admin

**Request:**
```json
{
  "busId": "674abc789..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Bus assigned to user successfully.",
  "data": {
    "user": { ... },
    "busOccupancy": {
      "occupied": 15,
      "capacity": 40,
      "remaining": 25
    }
  }
}
```

**Notes:**
- Sets permanent route (`busId`)
- If bus has active trip, also sets `currentBusId` (boards them)
- If user was on another bus, removes from that bus's active trip

#### Unassign User from Bus

**PATCH** `/api/users/:id/unassign-bus`  
**Auth:** Admin

**Response (200):**
```json
{
  "success": true,
  "message": "Bus unassigned from user successfully.",
  "data": {
    "user": { ... },
    "busOccupancy": { ... }
  }
}
```

#### Bulk Assign Users to Bus

**PATCH** `/api/users/bulk-assign-bus`  
**Auth:** Admin

**Request:**
```json
{
  "busId": "674abc789...",
  "userIds": ["674abc111...", "674abc222...", "674abc333..."]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "3 assigned, 0 failed.",
  "data": {
    "assigned": [
      { "userId": "...", "name": "Ravi Kumar" },
      { "userId": "...", "name": "Priya Sharma" }
    ],
    "failed": [
      { "userId": "...", "reason": "User is inactive." }
    ],
    "busOccupancy": {
      "occupied": 2,
      "capacity": 40,
      "remaining": 38
    }
  }
}
```

**Notes:**
- Max 100 users per request
- Returns per-user success/failure breakdown

---

### Buses

All bus endpoints require **Admin** role and are scoped to the admin's school.

#### Create Bus

**POST** `/api/buses`  
**Auth:** Admin

**Request:**
```json
{
  "busNumber": "BUS-001",
  "capacity": 40
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Bus created successfully.",
  "data": {
    "_id": "674abc789...",
    "busNumber": "BUS-001",
    "schoolId": "...",
    "driverId": null,
    "capacity": 40,
    "isActive": true,
    "occupied": 0,
    "remaining": 40,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Notes:**
- `busNumber` must be unique within the school
- `capacity` is optional

#### List Buses

**GET** `/api/buses`  
**Auth:** Admin

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "busNumber": "BUS-001",
      "schoolId": "...",
      "driverId": {
        "_id": "...",
        "name": "Bus Driver Ramesh",
        "phone": "+919800000001"
      },
      "capacity": 40,
      "isActive": true,
      "occupied": 15,
      "remaining": 25
    }
  ]
}
```

#### Get Bus by ID

**GET** `/api/buses/:id`  
**Auth:** Admin

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "busNumber": "BUS-001",
    "driverId": { ... },
    "capacity": 40,
    "students": [
      {
        "_id": "...",
        "name": "Ravi Kumar",
        "phone": "+919876543210",
        "rollNumber": "2024-A-101",
        "isActive": true
      }
    ],
    "occupied": 15,
    "remaining": 25
  }
}
```

#### Assign Driver to Bus

**PATCH** `/api/buses/:busId/assign-driver`  
**Auth:** Admin

**Request:**
```json
{
  "driverId": "674abc999..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Driver assigned successfully.",
  "data": {
    "_id": "...",
    "busNumber": "BUS-001",
    "driverId": {
      "_id": "...",
      "name": "Bus Driver Ramesh",
      "phone": "+919800000001"
    }
  }
}
```

**Notes:**
- Driver must be in same school
- Driver cannot be assigned if bus has active trip
- Previous driver (if any) is automatically unassigned

#### Unassign Driver from Bus

**PATCH** `/api/buses/:busId/unassign-driver`  
**Auth:** Admin

**Notes:**
- Cannot unassign if bus has active trip

---

### Trips

Trip endpoints are role-specific.

#### Start Trip (Driver)

**POST** `/api/trips/start`  
**Auth:** Driver

**Response (200):**
```json
{
  "success": true,
  "message": "Trip started successfully.",
  "data": {
    "_id": "674abc777...",
    "busId": "674abc789...",
    "driverId": "674abc999...",
    "schoolId": "...",
    "startTime": "2024-01-15T08:00:00.000Z",
    "endTime": null,
    "status": "ACTIVE",
    "students": [],              // Empty initially - driver boards at stops
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Notes:**
- Driver must have assigned bus
- Only one active trip per bus
- Trip starts with empty `students[]` (per-stop boarding)

#### Board Students (Driver)

**POST** `/api/trips/current/board`  
**Auth:** Driver

**Request (single):**
```json
{
  "studentId": "674abc111..."
}
```

**Request (multiple):**
```json
{
  "studentIds": ["674abc111...", "674abc222..."]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "2 student(s) boarded.",
  "data": {
    "_id": "...",
    "busId": { "busNumber": "BUS-001" },
    "driverId": { "name": "Bus Driver Ramesh" },
    "students": [
      {
        "_id": "...",
        "name": "Ravi Kumar",
        "phone": "+919876543210",
        "rollNumber": "2024-A-101"
      }
    ],
    "occupied": 2,
    "remaining": 38
  }
}
```

**Notes:**
- Students must be on this bus's route (`busId` matches)
- Sets `currentBusId` for boarded students
- Adds to `trip.students[]`

#### Unboard Students (Driver)

**POST** `/api/trips/current/unboard`  
**Auth:** Driver

**Request:**
```json
{
  "studentId": "674abc111..."
}
```
or
```json
{
  "studentIds": ["674abc111...", "674abc222..."]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "1 student(s) unboarded.",
  "data": {
    "_id": "...",
    "students": [ ... ],
    "occupied": 1,
    "remaining": 39
  }
}
```

**Notes:**
- Removes from `trip.students[]`
- Clears `currentBusId` for unboarded students

#### End Trip (Driver)

**POST** `/api/trips/end`  
**Auth:** Driver

**Response (200):**
```json
{
  "success": true,
  "message": "Trip ended successfully.",
  "data": {
    "_id": "...",
    "busId": { "busNumber": "BUS-001" },
    "driverId": { "name": "Bus Driver Ramesh" },
    "status": "COMPLETED",
    "startTime": "2024-01-15T08:00:00.000Z",
    "endTime": "2024-01-15T09:30:00.000Z",
    "students": [
      {
        "_id": "...",
        "name": "Ravi Kumar",
        "phone": "+919876543210",
        "rollNumber": "2024-A-101"
      }
    ],
    "occupied": 2,
    "remaining": 38
  }
}
```

**Notes:**
- Clears `currentBusId` for all students on trip
- `busId` (permanent route) stays unchanged
- Emits `trip_ended` socket event

#### Get Current Trip (Parent)

**GET** `/api/trips/current`  
**Auth:** Parent

**Response (200) - Active trip:**
```json
{
  "success": true,
  "message": "Active trip found.",
  "data": {
    "_id": "...",
    "busId": { "busNumber": "BUS-001" },
    "driverId": { "name": "Bus Driver Ramesh", "phone": "+919800000001" },
    "status": "ACTIVE",
    "startTime": "2024-01-15T08:00:00.000Z",
    "students": [ ... ],
    "occupied": 15,
    "remaining": 25
  }
}
```

**Response (200) - No active trip:**
```json
{
  "success": true,
  "message": "No active trip for your bus.",
  "data": {
    "status": "NOT_RUNNING"
  }
}
```

#### List All Trips (Admin)

**GET** `/api/trips?status=ACTIVE`  
**Auth:** Admin  
**Query Params:** `status` (optional: "ACTIVE" | "COMPLETED")

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "busId": { "busNumber": "BUS-001", "capacity": 40 },
      "driverId": { "name": "Bus Driver Ramesh" },
      "status": "ACTIVE",
      "startTime": "...",
      "occupied": 15,
      "remaining": 25
    }
  ]
}
```

#### Get Trip by ID (Admin)

**GET** `/api/trips/:id`  
**Auth:** Admin

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "busId": { "busNumber": "BUS-001", "capacity": 40 },
    "driverId": { "name": "Bus Driver Ramesh" },
    "status": "COMPLETED",
    "startTime": "...",
    "endTime": "...",
    "students": [
      {
        "_id": "...",
        "name": "Ravi Kumar",
        "phone": "+919876543210",
        "rollNumber": "2024-A-101",
        "isActive": true
      }
    ],
    "occupied": 15,
    "remaining": 25
  }
}
```

---

## Real-Time Events (Socket.IO)

### Connection

**Endpoint:** `ws://localhost:4000` (same host as REST API)

**Connection:**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // JWT from login
  }
});
```

**Authentication:**
- JWT token must be provided in `socket.handshake.auth.token`
- Server validates token and loads user from DB
- Connection fails if token invalid or user inactive

### Room Assignment

Users automatically join rooms based on role:

| Role | Room(s) | Purpose |
|------|---------|---------|
| **Parent** | `bus_<busId>` | Receive location updates for their bus |
| **Driver** | `driver_<userId>`, `bus_<busId>` | Personal room + bus room |
| **Admin** | `school_<schoolId>` | Receive all bus locations in their school |

**Note:** Rooms are auto-joined on connection. Clients should not manually join/leave.

### Events

#### Parent Events

**`location_update`** - Live GPS update for their bus

```javascript
socket.on('location_update', (data) => {
  console.log(data);
  // {
  //   busId: "674abc789...",
  //   tripId: "674abc777...",
  //   schoolId: "...",
  //   lat: 28.6139,
  //   lng: 77.2090,
  //   speed: 35,
  //   timestamp: "2024-01-15T08:15:30.000Z"
  // }
});
```

**`trip_started`** - Trip began for their bus

```javascript
socket.on('trip_started', (data) => {
  // {
  //   tripId: "...",
  //   busId: "...",
  //   driverId: "...",
  //   startTime: "2024-01-15T08:00:00.000Z",
  //   status: "ACTIVE"
  // }
});
```

**`trip_ended`** - Trip ended for their bus

```javascript
socket.on('trip_ended', (data) => {
  // {
  //   tripId: "...",
  //   busId: "...",
  //   endTime: "2024-01-15T09:30:00.000Z",
  //   status: "COMPLETED"
  // }
});
```

#### Driver Events

**`location_update`** (emit) - Send GPS location

```javascript
socket.emit('location_update', {
  lat: 28.6139,
  lng: 77.2090,
  speed: 35  // optional
});
```

**Validation:**
- Driver must have assigned bus
- Active trip must exist for that bus
- Coordinates must be valid (-90 to 90 for lat, -180 to 180 for lng)
- Rate limited: minimum 3 seconds between updates

**`error`** - Validation or system error

```javascript
socket.on('error', (data) => {
  console.error(data.message);
  // "No active trip. Start a trip before sending location."
  // "Invalid coordinates. lat must be -90 to 90, lng -180 to 180."
});
```

#### Admin Events

**`all_locations`** - Snapshot of all live bus positions (on connect + on demand)

```javascript
socket.on('all_locations', (locations) => {
  // [
  //   {
  //     busId: "674abc789...",
  //     tripId: "674abc777...",
  //     schoolId: "...",
  //     lat: 28.6139,
  //     lng: 77.2090,
  //     speed: 35,
  //     timestamp: "2024-01-15T08:15:30.000Z"
  //   }
  // ]
});
```

**`bus_location_update`** - Real-time GPS update from any bus

```javascript
socket.on('bus_location_update', (data) => {
  // Same format as location_update
});
```

**`trip_started`** - Any bus started a trip

```javascript
socket.on('trip_started', (data) => {
  // Same format as parent trip_started
});
```

**`trip_ended`** - Any bus ended a trip

```javascript
socket.on('trip_ended', (data) => {
  // Same format as parent trip_ended
});
```

**`request_all_locations`** (emit) - Request fresh snapshot

```javascript
socket.emit('request_all_locations');
// Server responds with 'all_locations' event
```

### Connection Lifecycle

```javascript
socket.on('connect', () => {
  console.log('Connected:', socket.id);
  // Admin receives 'all_locations' immediately if buses are active
});

socket.on('connect_error', (err) => {
  console.error('Connection failed:', err.message);
  // "Authentication required. Provide token in handshake.auth.token."
  // "Token has expired. Please login again."
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

---

## Data Models

### User

```typescript
{
  _id: ObjectId;
  name: string;
  phone?: string;              // Unique within school (sparse)
  rollNumber?: string;         // Unique within school (sparse)
  password?: string;            // Hashed, never returned in API
  role: "admin" | "driver" | "parent";
  schoolId: ObjectId;          // Required
  busId?: ObjectId;             // Permanent route (never cleared on trip end)
  currentBusId?: ObjectId;      // Currently boarded (cleared on trip end)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Points:**
- `busId` = permanent route assignment (Model A)
- `currentBusId` = currently on a trip (set when boarded, cleared on trip end)
- Parents can login with `phone` OR `rollNumber`

### Bus

```typescript
{
  _id: ObjectId;
  busNumber: string;           // Unique within school
  schoolId: ObjectId;
  driverId?: ObjectId;          // Assigned driver
  capacity?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Trip

```typescript
{
  _id: ObjectId;
  busId: ObjectId;             // Required
  driverId: ObjectId;           // Required
  schoolId: ObjectId;           // Required
  startTime: Date;
  endTime?: Date;
  status: "ACTIVE" | "COMPLETED";
  students: ObjectId[];         // Snapshot of boarded students
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Points:**
- Only ONE active trip per bus (DB-level constraint)
- `students[]` is a snapshot - starts empty, populated as driver boards students
- `students[]` preserved after trip ends (historical record)

### School

```typescript
{
  _id: ObjectId;
  name: string;
  schoolCode: string;          // Unique, uppercase
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Multi-School Isolation

**Critical:** All data is isolated by school. Every query filters by `schoolId`.

**Rules:**
1. Users can only access data from their own school
2. JWT contains `schoolId` - server always validates
3. Admin from School A cannot see School B's buses/users/trips
4. Parent from School A cannot receive GPS from School B's buses
5. All API endpoints automatically filter by `req.user.schoolId`

**Implementation:**
- Server never trusts client-sent `schoolId`
- Always uses `req.user.schoolId` from JWT (validated on every request)
- Socket rooms are school-scoped (`school_<schoolId>` for admins)

---

## Role-Based Access Control

### Admin

**Can:**
- Create/manage schools
- Create/manage users (admin, driver, parent)
- Create/manage buses
- Assign drivers to buses
- Assign students to buses (permanent route)
- View all trips in their school
- See live locations of all buses in their school (Socket.IO)

**Cannot:**
- Start/end trips
- Board/unboard students
- See data from other schools

### Driver

**Can:**
- Start/end trips for their assigned bus
- Board/unboard students at stops
- Emit GPS location (during active trip)
- View their own trip status

**Cannot:**
- Create buses or users
- See other drivers' trips
- Access admin endpoints

### Parent

**Can:**
- View current trip status for their bus
- Receive live GPS updates (Socket.IO)
- Receive trip start/end notifications

**Cannot:**
- Start/end trips
- Board/unboard students
- See other buses or trips
- Access admin/driver endpoints

---

## Testing

### Seed Data

Run `npm run seed` to populate test data:

- **Schools:** DPS01, SMC01
- **Buses:** BUS-001 (DPS01), BUS-002 (DPS01), BUS-101 (SMC01)
- **Users:**
  - Admin: `+919999900000` / `admin123` (DPS01)
  - Driver: `+919800000001` / `driver123` (DPS01, BUS-001)
  - Parents: `2024-A-101`, `2024-A-102` / `parent123` (DPS01, BUS-001)

### Test Script

Run `npm run test:trip` to test the full trip boarding flow.

---

## Notes for Frontend Developers

1. **Always include JWT** in `Authorization: Bearer <token>` header for protected routes
2. **Handle token expiry** - Redirect to login when you get 401
3. **Socket reconnection** - Implement auto-reconnect with exponential backoff
4. **GPS updates** - Driver should emit location every 3-10 seconds (server rate-limits to 3s minimum)
5. **Trip state** - Check `currentBusId` to show "On trip" vs "Not on trip" for parents
6. **Capacity** - Always check `occupied` vs `capacity` before boarding students
7. **Error handling** - All errors follow the standard format - check `success` field
8. **Multi-school** - Never send `schoolId` in requests - server uses JWT
9. **Socket rooms** - Don't manually join/leave rooms - server handles it
10. **Pagination** - Not implemented yet - all list endpoints return all records

---

## Support

For questions or issues, contact the backend team or refer to the codebase at `/src/modules/`.
