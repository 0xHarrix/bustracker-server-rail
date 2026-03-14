# Bustracker Server – Documented Issues by Module

This folder contains design and implementation issues identified during module critiques. Each subfolder corresponds to a server module and has an `ISSUES.md` file.

## Structure

| Folder   | Module  | Source path                          |
|----------|---------|--------------------------------------|
| `trips/` | Trips   | `bustracker-server/src/modules/trips` |
| `buses/` | Buses   | `bustracker-server/src/modules/buses` |
| `schools/` | Schools | `bustracker-server/src/modules/schools` |
| `users/` | Users   | `bustracker-server/src/modules/users` |
| `auth/`  | Auth    | `bustracker-server/src/modules/auth`  |

## How to use

- Open the module folder and read `ISSUES.md` for a list of issues with severity, type, description, location, and suggested fix.
- Issues are written so they can be tackled independently; references point to API doc and source files under `bustracker-server/`.

## Severity legend

- **High:** Security, data integrity, or major correctness (fix soon).
- **Medium:** Consistency, performance, or important UX/completeness.
- **Low:** Doc, small API improvements, or code quality.

Last consolidated from module critiques (trips, buses, schools, users, auth).
