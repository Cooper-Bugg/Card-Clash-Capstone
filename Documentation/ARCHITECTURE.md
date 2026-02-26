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

## 3. Database Schema

**Card Clash** uses a MySQL database with 8 core tables following a teacher-centric design. The schema supports both simplified JSON storage (current mock implementation) and normalized relational structure (production target).

### Core Tables
* **`teachers`** - Teacher accounts (username, email, password_hash)
* **`decks`** - Question deck metadata (deck_name, description, is_public, owner_id)
* **`questions`** - Individual questions per deck (question_text, correct_answer, answer_options as JSON)
* **`game_sessions`** - Game instances (session_code, host_teacher_id, deck_id, game_log_json, ai_summary_text)
* **`session_results`** - Raw per-player, per-question data (player_name, answer_given, is_correct, response_time_ms)
* **`deck_saves`** - Many-to-many for public deck bookmarking (teacher_id, deck_id, is_cloned)

### Analytics Tables
* **`session_summaries`** - Cached per-player stats (final_score, rank, accuracy_pct, avg_response_ms)
* **`question_metrics`** - Rolling question stats (times_seen, times_correct, difficulty_index)
* **`deck_metrics`** - Aggregate deck health (total_sessions, avg_accuracy_pct, save_count)

### Naming Conventions
* **Database:** snake_case (session_id, teacher_id, deck_id)
* **Code/API:** camelCase (sessionID, teacherID, deckID)
* **Mapping:** `deckID → deck_id`, `sessionID → session_id`, `teacherID → teacher_id`

### Current Implementation Note
The live codebase currently uses a simplified mock model with `mockDecks[].contentJson` containing embedded questions and `mockSessions` with summary data. This will migrate to the normalized schema above for production MySQL deployment.

---

## 4. Domain Model

### Session (Current Implementation)
* `sessionID` (Number): Internal Database ID
* `deckID` (Number): Reference to question deck
* `deckTitle` (String): Display name for UI
* `summaryParagraphs` (Array): AI-generated analysis paragraphs
* `metrics` (Object): `{ roundsPlayed, averageAccuracy, averageResponseTime }`

### Deck (Current Implementation)  
* `id` (Number): Primary key
* `title` (String): Display name
* `contentJson` (String): Serialized questions array with optionA/B/C/D format

### The "Split" State Model
* **Lobby/Game State:** Live in Photon Cloud (Ephemeral)
* **Historical Data:** Live in MySQL (Persistent)
* **Bridge:** The Teacher's Unity Client acts as the "Recorder," sending the full Game Log JSON to the Node.js API at the end of the match

---

## 5. API Contracts (Node.js)

The backend renders HTML directly with simplified JSON APIs for AI processing.

### Web Routes (Browser)
* **GET** `/` - Home/Login redirect
* **GET** `/login` - Teacher login page
* **POST** `/login` - Process authentication (form-based)
* **GET** `/dashboard` - Teacher home (view history, start game)
* **GET** `/game/play?deckID=1` - Serves the Unity WebGL client
* **GET** `/report/:id` - View AI summary and metrics

### Data Routes (JSON) - Current Implementation
* **POST** `/api/ai/summarize`
    * *Input:* Game log JSON data
    * *Action:* Triggers Ollama AI analysis
    * *Output:* Summary paragraphs
* **GET** `/api/ai/report/:sessionID`
    * *Output:* Cached AI report for session
* **POST** `/api/ai/report/:sessionID`
    * *Input:* Manual report regeneration request

---

## 6. Realtime Protocol (Photon PUN 2)

**Room Name:** Equal to `sessionCode`.
**Authority:** The Teacher's Client is the Master Client and handles scoring logic.

### Event Codes (Byte)
* `1` **START_GAME**: Master Client -> All (Load Game Scene).
* `2` **SUBMIT_ANSWER**: Student -> Master Client (Send Answer Index).
* `3` **SHOW_RESULTS**: Master Client -> All (Show Leaderboard).

---

## 7. AI Report Specification

**Trigger:** The Teacher's Unity Client sends the game log to Node.js.
**Process:** Node.js calculates stats -> Sends prompt to Ollama -> Saves result to MySQL.
**Output:** 3 Paragraphs (Class Performance, Knowledge Gaps, Recommendations).
**Timeout:** 60 Seconds.

### AI Analysis Structure
* **Paragraph 1:** Class performance overview and engagement patterns
* **Paragraph 2:** Knowledge gaps and misconception analysis  
* **Paragraph 3:** Recommendations for future sessions

---

## 8. Development Notes

### File Structure
* **`app.js`** - Main Express server with routes and middleware
* **`data.js`** - Mock data layer (to be replaced with MySQL queries)
* **`views/*.ejs`** - Server-side rendered HTML templates
* **`public/`** - Static assets (CSS, fonts, Unity builds)
* **`Documentation/`** - Architecture docs and database schema visual

### Migration Path
Current mock implementation → Production MySQL schema:
1. Replace `mockDecks` with normalized `decks` + `questions` tables
2. Replace `mockSessions` with `game_sessions` + analytics tables
3. Implement camelCase ↔ snake_case property mapping
4. Add proper foreign key relationships and constraints

For detailed database schema visualization, see `Documentation/DatabaseSchemaHTML.html`.