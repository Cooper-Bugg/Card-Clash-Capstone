# Card Clash - Senior Capstone Project

Repository for **Card Clash**, an educational party style game where a teacher hosts a session and students join using a short session code. Gameplay runs in real time via Photon Cloud. After the game ends, the Teacher client uploads a game log and the system generates a 3 paragraph summary.

This README is a team hub for early development. It defines the MVP scope, shared terminology, repository layout and the contracts that must stay stable while implementation evolves.

---

## Getting Started

### Installation

```bash
npm install
```

### Running the Frontend Server

```bash
npm start
```

The frontend server will start on `http://localhost:3000`

**Note:** Currently, only the frontend (Web Dashboard) is running on this server.

---

## Team

- Trevor Mendenhall
- Graham Troast
- Ahamd Coleman
- Josh Price
- Cooper Huntington-Bugg

## Project Summary

Card Clash is an educational party game. A teacher hosts a session. Students join using a short session code. Gameplay runs in real time via Photon Cloud. When the game ends, the Teacher client uploads the game log, which triggers an AI-generated 3-paragraph summary.

### Architecture
- Web Dashboard: Server-Side Rendered (SSR) using EJS templates served by Express
- Game Client: Unity WebGL build running in a browser

### Backend
- Node.js + Express (OSU servers) handles API logic and UI rendering
- Database: Microsoft SQL Server (using JSON columns for flexibility)

### Realtime Networking
- Transport: Photon PUN 2 (Photon Cloud)
- Authority: Teacher's Unity Client acts as authoritative host for game logic, scoring and timing
- Backend is used only for storage and AI processing

### AI
- Generates a 3 paragraph summary from the final Game Log (FR-1)
- Must complete within 60 seconds after game upload (NFR-2)

### MVP Scale Target
- Single active teacher session
- Small classroom scale for testing
- One game at a time is acceptable for MVP

---

## Nonnegotiable Requirements (SRS)

FR-1: LLM generates 3-paragraph summary from end-of-game data

NFR-1: real-time sync within 200 ms (managed by Photon)

NFR-2: LLM inference within 60 seconds after game end

NFR-3: server components must fit within OSU student server quotas

---

## Hard Assumptions for MVP

- Teacher trust: the Teacher's Unity instance is trusted to calculate scores and validate answers.
- Single artifact: the game history is stored as a single JSON blob, not normalized SQL tables.
- No complex auth: teachers use a simple login; students use ephemeral session codes.
- Offline logic: the backend does not know game state (Lobby vs. In-Game). It only knows when a game log is uploaded.

---

## Hosting Topology Target

- Web App (Dashboard + API): OSU Server (Node.js)
- Database: OSU MS SQL Server
- Unity WebGL: hosted statically within the Node.js public/ folder

Important: Unity WebGL in browser will require HTTPS for many browser features. Photon Cloud uses HTTPS and WSS endpoints, so classroom networks and firewalls must allow outbound 443.

---

## System Boundaries and Trust

### Trusted
- Node.js backend
- MS SQL database
- Teacher Unity Client for game logic authority (MVP assumption)

### Untrusted
- Student Unity WebGL client

### Security baseline
- Backend stores data and AI summaries; it does not validate gameplay in MVP
- Teacher authentication uses a simple login (session cookie)

---

## Domain Model

Use these terms consistently across code and API contracts.

### Session
- `sessionId` INT/UUID
- `teacherId` INT/UUID
- `datePlayed` DATETIME
- `gameLog` JSON (full history of rounds, answers, scores)
- `aiSummary` TEXT (3-paragraph report)

### User (Teacher)
- `userId` INT/UUID
- `username` STRING
- `passwordHash` STRING

### Deck
- `deckId` INT/UUID
- `userId` FK
- `title` STRING
- `content` JSON (array of questions and answers)

---

## Database Schema (MS SQL)

To reduce overhead, use NVARCHAR(MAX) columns to store structured JSON data, avoiding complex joins.

### Users
- `user_id` PK
- `username` VARCHAR(50)
- `password_hash` VARCHAR(255)

### Decks
- `deck_id` PK
- `user_id` FK
- `title` VARCHAR(100)
- `content_json` NVARCHAR(MAX)

### Sessions
- `session_id` PK
- `user_id` FK
- `created_at` DATETIME
- `game_log_json` NVARCHAR(MAX)
- `ai_summary_text` NVARCHAR(MAX)

---

## API Contracts 

The backend serves HTML pages directly. API endpoints are limited to auth and data upload.

### Web Routes (Browser Navigation)
- GET / - Login Page
- GET /dashboard - Teacher Dashboard (list past sessions, start new game)
- GET /game/play - Serves the Unity WebGL player
- GET /report/:id - View a specific game report

### Data Routes (JSON)

#### POST /api/login
Standard auth.

Request:
- `{ "username": "...", "password": "..." }`

Response:
- Sets session cookie

#### GET /api/decks
Used by Unity to fetch questions.

Response:
- `[ { "id": 1, "title": "Math 101", "content": { ... } } ]`

#### POST /api/upload-log
Triggered by Unity when the game ends.

Request:
- `{ "deckId": 1, "log": { ...huge json object... } }`

Action:
- Saves JSON to Sessions table
- Triggers async LLM processing

Response:
- `{ "reportId": 101, "status": "PROCESSING" }`

---

## Realtime Protocol (Photon PUN 2)

Teacher Client = Master Client. Student Client = Peer.

Since the backend is no longer authoritative, the Teacher's Client handles:
- Loading the deck
- Broadcasting Round Start
- Receiving Answer Submitted events from students
- Calculating correctness
- Sending Round End scores

---

## AI Report Specification

The LLM must output exactly three paragraphs. The backend enforces this format.

### Inputs to LLM
The final Game Log uploaded by the Teacher client.

### Failure behavior
If inference fails or exceeds 60 seconds, store the failure and show a fallback explanation in the report view.

---

## Repo Structure (Target)

Use a monorepo to reduce friction.
