# Bustracker Server – Module Reference

This folder contains **MODULE.md** files for each server module. Each document describes how the module works, its APIs, data flow, and integration points so an agent or developer can understand and modify the codebase.

**Base path:** All modules live under `bustracker-server/src/modules/`.  
**API base URL:** `http://localhost:4000` (development). All REST APIs are under `/api/<module>`.

## Module index

| Folder    | MODULE.md   | Purpose |
|-----------|-------------|--------|
| `auth/`   | [MODULE.md](auth/MODULE.md)   | Login, JWT, get current user |
| `users/`  | [MODULE.md](users/MODULE.md)  | User CRUD (admin), assign/unassign bus |
| `schools/`| [MODULE.md](schools/MODULE.md)| School CRUD (admin) |
| `buses/`  | [MODULE.md](buses/MODULE.md) | Bus CRUD (admin), assign/unassign driver |
| `trips/`  | [MODULE.md](trips/MODULE.md) | Trip lifecycle (driver/parent/admin), board/unboard |

## Cross-cutting pieces

- **Auth:** `authenticate` (JWT) and `authorize(role)` live in `src/middlewares/`. All protected routes use them.
- **Response helpers:** `success`, `created`, `badRequest`, `notFound`, `conflict`, `unauthorized`, `forbidden` from `src/utils/response.js`.
- **Real-time:** Socket.IO is in `src/realtime/`; trips module emits `trip_started` / `trip_ended`; drivers emit `location_update`.

## How to use

Read the MODULE.md for the area you are working in. Each file includes:

- **Purpose & scope** – what the module owns
- **Dependencies** – models, utils, other modules
- **APIs** – method, path, auth, request/response, behavior
- **Key logic** – how things are handled
- **Integration** – socket events, other modules
