# Card Clash - Senior Capstone Project

Repository for **Card Clash**, an educational party style game where a teacher hosts a session and students join using a short session code. Gameplay runs in real time. After the game ends the system generates a 3 paragraph summary and class metrics for the teacher dashboard.

This README is a team hub for early development. It defines the MVP scope, shared terminology, repository layout and the contracts that must stay stable while implementation evolves.

---

## Team

- Trevor Mendenhall
- Graham Troast
- Ahamd Coleman
- Josh Price
- Cooper Huntington-Bugg

## Project Summary

Card Clash is an educational party game. A teacher hosts a session. Students join using a short session code. Gameplay runs in real time. After the game ends the system generates a 3 paragraph summary and class metrics for the teacher dashboard.

### Clients
- Student client: Unity WebGL build running in a browser
- Teacher dashboard: React web app running in a browser

### Backend
- Node.js + Express API (hosted on OSU servers)
- Database: MySQL (OSU server or OSU provided MySQL if available)

### Realtime Networking
- Photon PUN 2 using **Photon Cloud** for realtime session transport
- Backend remains authoritative for persistence, reporting and teacher controls

### AI
- Generates a 3 paragraph summary from end of game data (FR-1)
- Generates class metrics and optional recommendations
- Must complete within 60 seconds after game end (NFR-2)

### MVP Scale Target
- 1 teacher session
- Up to 4 student players
- One game at a time is acceptable for MVP

---

## Nonnegotiable Requirements (SRS)

FR-1: LLM generates 3-paragraph summary from end-of-game data

NFR-1: real-time sync within 200 ms

NFR-2: LLM inference within 60 seconds after game end

NFR-3: server components must fit within OSU student server quotas

---

## Hard Assumptions for MVP

- Only one active game session per teacher at a time.
- Each session has a unique short code, 6 characters, uppercase alphanumeric.
- Players do not need accounts. Players are identified by an ephemeral `playerId` assigned by the backend.
- Teacher is the only trusted UI for starting and ending games.
- Students are untrusted clients. The backend must validate all inputs.
- Post game AI summary can be delayed up to 60 seconds. If it fails, the dashboard must show a fallback message and still show raw metrics.

---

## Hosting Topology Target (MVP Friendly)

This is the default topology the code should assume. If OSU constraints force changes, only configuration should change.

- React Teacher Dashboard: static hosting (GitHub Pages)
- Backend API: OSU server (Node.js)
- MySQL: OSU server (or OSU provided MySQL service if available)
- Unity WebGL build: static hosting (GitHub Pages or OSU, depends on disk quota and build size)

Important: Unity WebGL in browser will require HTTPS for many browser features. Photon Cloud uses HTTPS and WSS endpoints, so classroom networks and firewalls must allow outbound 443.

---

## System Boundaries and Trust

### Trusted
- Node.js backend
- MySQL database

### Untrusted
- Student Unity WebGL client
- Teacher React client, except for teacher authentication token if used

### Security baseline
- Never trust client reported scores, timing, correctness, or game end conditions
- Backend computes correctness and metrics using server stored answer keys and server timestamps
- If teacher authentication exists, use a signed token issued by backend

---

## Domain Model

Use these terms consistently across code and API contracts.

### Session
- `sessionId` UUID
- `sessionCode` 6 char code
- `teacherId` UUID or string
- `status` enum: `LOBBY`, `IN_GAME`, `ENDED`
- `createdAt`, `endedAt`

### Player
- `playerId` UUID
- `sessionId`
- `displayName`
- `connected` boolean
- `joinedAt`, `leftAt`

### Round
- `roundId` UUID
- `sessionId`
- `index` integer
- `prompt` text
- `options` JSON (A, B, C, D)
- `correctOption` char, stored backend side only
- `startedAt`, `endedAt`

### Answer
- `answerId` UUID
- `roundId`
- `playerId`
- `selectedOption` char
- `isCorrect` boolean computed backend side
- `responseMs` integer (computed backend side)
- `createdAt`

### Report
- `reportId` UUID
- `sessionId`
- `summaryText` long text
- `metricsJson` JSON
- `modelInfo` string
- `status` enum: `PENDING`, `READY`, `FAILED`
- `createdAt`

---

## Database Schema (MySQL)

Implement these tables first. Keep names stable.

### sessions
- `session_id` CHAR(36) PK
- `session_code` VARCHAR(6) UNIQUE
- `teacher_id` VARCHAR(64)
- `status` ENUM('LOBBY','IN_GAME','ENDED')
- `created_at` DATETIME
- `ended_at` DATETIME NULL

### players
- `player_id` CHAR(36) PK
- `session_id` CHAR(36) FK
- `display_name` VARCHAR(32)
- `connected` TINYINT
- `joined_at` DATETIME
- `left_at` DATETIME NULL

### rounds
- `round_id` CHAR(36) PK
- `session_id` CHAR(36) FK
- `round_index` INT
- `prompt` TEXT
- `options_json` JSON
- `correct_option` CHAR(1)
- `started_at` DATETIME
- `ended_at` DATETIME NULL

### answers
- `answer_id` CHAR(36) PK
- `round_id` CHAR(36) FK
- `player_id` CHAR(36) FK
- `selected_option` CHAR(1)
- `is_correct` TINYINT
- `response_ms` INT
- `created_at` DATETIME

### reports
- `report_id` CHAR(36) PK
- `session_id` CHAR(36) FK
- `status` ENUM('PENDING','READY','FAILED')
- `summary_text` LONGTEXT NULL
- `metrics_json` JSON NULL
- `model_info` VARCHAR(128) NULL
- `created_at` DATETIME

### Indexes
- `sessions(session_code)`
- `players(session_id)`
- `rounds(session_id, round_index)`
- `answers(round_id)`
- `reports(session_id)`

---

## API Contracts

The backend must implement these endpoints exactly. All responses are JSON.

### Auth Model (MVP)
For MVP, do not build full auth. Use a teacher secret created backend side for each session.

#### POST /api/sessions
Creates a session and returns session code and teacher token.

Request:
- `{ "teacherName": "string" }`

Response:
- `{ "sessionId": "...", "sessionCode": "ABC123", "teacherToken": "..." }`

#### POST /api/sessions/:code/join
Student joins a session.

Request:
- `{ "displayName": "string" }`

Response:
- `{ "sessionId": "...", "playerId": "...", "reconnectToken": "..." }`

#### GET /api/sessions/:code/state
Teacher dashboard fetches lobby or game state.

Headers:
- `Authorization: Bearer <teacherToken>`

Response:
- `{ "status": "LOBBY", "players": [...], "roundIndex": 0 }`

#### POST /api/sessions/:code/start
Teacher starts the game.

Headers:
- `Authorization: Bearer <teacherToken>`

Request:
- `{ "deckId": "default" }`

Response:
- `{ "ok": true }`

#### POST /api/sessions/:code/end
Teacher ends the game and triggers report generation.

Headers:
- `Authorization: Bearer <teacherToken>`

Response:
- `{ "reportId": "...", "status": "PENDING" }`

#### GET /api/reports/:reportId
Teacher dashboard polls for report completion.

Headers:
- `Authorization: Bearer <teacherToken>`

Response:
- `{ "status": "READY", "summaryText": "...", "metrics": {...} }`

Notes:
- Realtime gameplay uses Photon Cloud. REST remains the source of truth for persistence and reporting.
- Teacher dashboard should not need a direct websocket connection for MVP. It can poll state endpoints and subscribe later if needed.

---

## Realtime Protocol (Photon PUN 2, Photon Cloud)

Realtime gameplay uses Photon Cloud rooms. This repo treats Photon as the transport. Game events must still follow stable contracts and remain backend-consumable for persistence and reporting.

### Room and Identity
- Room name: `sessionCode` (6 char code)
- Player Photon nickname: `playerId` (UUID), not displayName
- Display name is stored in backend and in room custom properties if needed for UI

### Event Contracts (conceptual)
Implement the same logical events as the websocket spec, mapped onto Photon RaiseEvent or RPC.

Server-authoritative rule for MVP:
- Backend is authoritative for answer keys, scoring and metrics.
- Clients may exchange realtime UX events via Photon, but persisted results must be validated by backend.

Minimum event set:
- `SESSION_STATE`
- `ROUND_START`
- `SUBMIT_ANSWER`
- `ROUND_END`
- `GAME_END`
- `ERROR`

Timing rule:
- Response time metrics must be computed from backend timestamps or from a single agreed server time source, not from arbitrary client clocks.

---

## AI Report Specification

The LLM must output exactly three paragraphs. The backend enforces this format.

### Inputs to LLM
Minimize data. Never send raw student names if not required. Use pseudonyms.

Prompt input JSON (constructed backend side):
- Session metadata:
  - sessionCode
  - number of players
  - number of rounds
- Per round summary:
  - correct option
  - distribution of answers
  - average response time
- Per player metrics:
  - correct count
  - average response time
  - streaks
- Class level patterns:
  - hardest rounds
  - most common wrong option per round

### Output schema
- `summaryText` string with 3 paragraphs
- `recommendations` array of short bullets, optional
- `riskFlags` array, optional

### Failure behavior
If inference fails or exceeds 60 seconds:
- mark report `FAILED`
- store metrics anyway
- teacher dashboard shows metrics and a fallback explanation string

---

## Repo Structure (Target)

Use a monorepo to reduce friction.

