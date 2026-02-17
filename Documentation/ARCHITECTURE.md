# Card Clash - Senior Capstone Project

**Card Clash** is an educational party game where a teacher hosts a session and students join using a short session code. Gameplay runs in real time via Photon Cloud. After the game ends, the system generates a 3-paragraph summary and class metrics using an LLM.

---

## 1. Project Scope & Architecture

### Clients
* **Student Client:** Unity WebGL build (Browser).
* **Teacher Dashboard:** Server-Side Rendered Web App (Node.js/EJS).

### Backend
* **Server:** Node.js + Express (OSU Server).
* **Database:** MySQL (utilizing JSON columns for flexibility).
* **Networking:** Photon PUN 2 (Photon Cloud) for real-time sync.
* **AI:** Ollama (Local or Server) for post-game analysis.

### MVP Targets
* **Scale:** 1 Teacher, 4 Students.
* **Odd Teams:** If we have fewer than 4 players, we will add an AI bot or implement a team balancing system to keep gameplay fair and competitive.
* **Flow:** Teacher creates session (Web) -> Launches Game (Unity) -> Students join Photon Room -> Game Loop -> Teacher submits Logs to API -> API triggers AI Report.

---

## 2. Non-Negotiable Requirements (SRS)

* **FR-1:** LLM generates 3-paragraph summary from end-of-game data.
* **NFR-1:** Real-time sync within 200 ms (via Photon).
* **NFR-2:** LLM inference within 60 seconds after game end.
* **NFR-3:** Server components must fit within OSU student server quotas.

---

## 3. Domain Model

### Session (Stored in MySQL)
* `sessionId` (PK): Internal Database ID.
* `sessionCode` (String): 6-char code (e.g., "AF492B") used for Photon Room Name.
* `gameLogJson` (JSON): The full history of the game (rounds, answers, scores).
* `aiSummary` (TEXT): The generated text report.

### The "Split" State Model
* **Lobby/Game State:** Live in Photon Cloud (Ephemeral).
* **Historical Data:** Live in MySQL (Persistent).
* **Bridge:** The Teacher's Unity Client acts as the "Recorder," sending the full Game Log JSON to the Node.js API at the end of the match.

---

## 4. API Contracts (Node.js)

Since the backend renders HTML directly, the API is simplified to Auth and Data Upload.

### Web Routes (Browser)
* **GET** `/` - Login Page.
* **GET** `/dashboard` - Teacher Home (View History, Start Game).
* **GET** `/game/play?deckId=1` - Serves the Unity WebGL Client.
* **GET** `/report/:id` - View the AI Summary and metrics.

### Data Routes (JSON)
* **POST** `/api/login`
    * *Input:* `{ "username": "...", "password": "..." }`
    * *Output:* Session Cookie.
* **POST** `/api/upload-log`
    * *Input:* `{ "deckId": 1, "log": { ...huge json object... } }`
    * *Action:* Saves JSON to MySQL -> Triggers Async Ollama Process.
    * *Output:* `{ "reportId": 101, "status": "PROCESSING" }`

---

## 5. Realtime Protocol (Photon PUN 2)

**Room Name:** Equal to `sessionCode`.
**Authority:** The Teacher's Client is the Master Client and handles scoring logic.

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