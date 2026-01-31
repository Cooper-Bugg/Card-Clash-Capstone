# Card Clash - Senior Capstone Project

**Card Clash** is an educational party game where a teacher hosts a session and students join using a short session code. Gameplay runs in real time via Photon Cloud. After the game ends, the system generates a 3-paragraph summary and class metrics using an LLM.

---

## 1. Project Scope & Architecture

### Clients
* **Student Client:** Unity WebGL build (Browser).
* **Teacher Dashboard:** React web app (Browser).

### Backend
* **API:** Node.js + Express (OSU Server).
* **Database:** MySQL (OSU Server).
* **Networking:** Photon PUN 2 (Photon Cloud) for real-time sync.
* **AI:** Ollama (Local or Server) for post-game analysis.

### MVP Targets
* **Scale:** 1 Teacher, 4 Students.
* **Odd Teams:** If we have fewer than 4 players, we'll add an AI bot or implement a team balancing system to keep gameplay fair and competitive.
* **Flow:** Teacher creates session -> Students join Photon Room -> Game Loop -> Teacher submits Logs to API -> API triggers AI Report.

---

## 2. Non-Negotiable Requirements (SRS)

* **FR-1:** LLM generates 3-paragraph summary from end-of-game data.
* **NFR-1:** Real-time sync within 200 ms (via Photon).
* **NFR-2:** LLM inference within 60 seconds after game end.
* **NFR-3:** Server components must fit within OSU student server quotas.

---

## 3. Domain Model

### Session
* `sessionId` (UUID): Internal Database ID.
* `sessionCode` (String): 6-char code (e.g., "AF492B") used for Photon Room Name.
* `teacherSecret` (String): Temporary token for the React Dashboard to authorize API calls.

### The "Split" State Model
* **Lobby/Game State:** Live in Photon Cloud (Ephemeral).
* **Historical Data:** Live in MySQL (Persistent).
* **Bridge:** The Teacher's Unity Client acts as the "Recorder," sending Game Logs to the Node.js API at the end of the match.

---

## 4. API Contracts (Node.js)

### Auth & Session Management
* **POST** `/api/sessions`
    * *Input:* `{ "teacherName": "Mr. Smith" }`
    * *Output:* `{ "sessionId": "...", "sessionCode": "AF492B", "teacherToken": "..." }`
* **POST** `/api/sessions/:code/end`
    * *Input:* Full Game Log JSON (See Reporting Schema).
    * *Output:* `{ "reportId": "...", "status": "PENDING" }`

### Reporting
* **GET** `/api/reports/:reportId`
    * *Output:* `{ "status": "READY", "summary": "...", "metrics": {...} }`

---

## 5. Realtime Protocol (Photon PUN 2)

**Room Name:** Equal to `sessionCode`.

### Event Codes (Byte)
* `1` **START_GAME**: Master Client -> All (Load Game Scene).
* `2` **SUBMIT_ANSWER**: Student -> Master Client (Send Answer Index).
* `3` **SHOW_RESULTS**: Master Client -> All (Show Leaderboard).

---

## 6. AI Report Specification

**Trigger:** The Teacher's Unity Client sends the game log to Node.js.
**Process:** Node.js calculates stats -> Sends prompt to Ollama -> Saves result to MySQL.
**Output:** 3 Paragraphs (Class Performance, Knowledge Gaps, Recommendations).
**Timeout:** 60 Seconds.