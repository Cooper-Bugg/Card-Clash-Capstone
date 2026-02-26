# Card Clash — Senior Capstone Project

Card Clash is an educational party game. A teacher hosts a session and students join with a short code. Gameplay runs in real time via Photon Cloud. When the game ends, the Teacher client uploads the game log and the backend generates a 3-paragraph AI summary.

To run locally: `npm install && npm start` then open `https://localhost:3000`. No database required.

---

## Setup

### Prerequisites

- **Node.js** — [nodejs.org](https://nodejs.org/) (LTS recommended)
- **MySQL** — only needed if working on database integration (see [Database Setup](#database-setup-mysql))

### Install and run

Install dependencies:

```bash
npm install
npm start
```

The server starts at **https://localhost:3000**

The first run auto-generates a self-signed HTTPS certificate in `certs/`. Your browser will show a security warning — click **Advanced → Proceed to localhost**. HTTPS is required for Unity WebGL Brotli-compressed assets to load.

### Default teacher login

  Username = `admin`
  Password = `password`

Credentials are set in `.env`. We can change them before deployment.

### Stopping the server

Press `Ctrl + C`. If it doesn't stop:

```bash
ps aux | grep node
kill -9 <PID>
```

### Unity WebGL build

The Unity build is already in `public/Unity/`. If you export a new build, drop the files there — it needs an `index.html` at the root. The server serves it at `/Unity/index.html` and handles Brotli-compressed assets (`.wasm.br`, `.js.br`, `.data.br`) automatically.

### Database Setup (MySQL)

The app uses mock data in `data.js` by default and runs without a database. Only do this if you're working on database integration.

---

## Team

- Trevor Mendenhall
- Graham Troast
- Ahmad Coleman
- Josh Price
- Cooper Huntington-Bugg

---

## Architecture

- **Web dashboard** — SSR with EJS templates served by Node.js/Express
- **Game client** — Unity WebGL running in the browser
- **Realtime** — Photon PUN 2 (Photon Cloud). The Teacher's Unity client is the authoritative host for game logic, scoring, and timing. The backend handles storage and AI only.
- **Database** — MySQL (OSU server). JSON columns for game logs and deck content to avoid complex joins.
- **AI** — LLM generates a 3-paragraph summary from the uploaded game log. Must complete within 60 seconds (NFR-2).
- **Hosting** — Dashboard + API on OSU Node.js server, DB on OSU MySQL. Unity WebGL served statically from `public/Unity/`.

HTTPS is required. Photon uses WSS/443 — classroom networks need outbound 443 open.

### Trust

- **Trusted:** Node.js backend, MySQL, Teacher Unity client (MVP assumption)
- **Untrusted:** Student Unity WebGL client
- The backend does not validate gameplay in MVP. The Teacher client handles scoring and answer validation.

---

### MVP assumptions

- The Teacher's Unity client is trusted for scores and answer validation
- Game history is stored as a single JSON blob, not normalized rows
- No complex auth — teachers log in with a password, students use session codes
- The backend doesn't track game state (lobby vs. in-game). It only knows when a log is uploaded.

---

## Domain Model

Use these names consistently across code and API contracts.

**Session**
- `sessionID` INT
- `teacherID` INT (FK → User)
- `deckID` INT (FK → Deck)
- `deckTitle` STRING — stored directly so reports don't need a join
- `datePlayed` DATETIME
- `roundsPlayed` INT
- `averageAccuracy` STRING — e.g. `"86%"`
- `averageResponseTime` STRING — e.g. `"5.4s"`
- `gameLog` JSON — full round history uploaded by Unity
- `aiSummary` TEXT — full 3-paragraph block
- `aiSummaryParagraph1/2/3` TEXT — split for the report view

**User (Teacher)**
- `userID` INT
- `username` STRING
- `passwordHash` STRING

**Deck**
- `deckID` INT
- `userID` FK
- `title` STRING
- `content` JSON — array of questions and answers

---

## Database Schema

### users
| Column | Type |
|--------|------|
| user_id | INT PK |
| username | VARCHAR(50) |
| password_hash | VARCHAR(255) |

### decks
| Column | Type |
|--------|------|
| deck_id | INT PK |
| user_id | INT FK → users |
| title | VARCHAR(100) |
| content_json | JSON |

### sessions
| Column | Type |
|--------|------|
| session_id | INT PK |
| user_id | INT FK → users |
| deck_id | INT FK → decks |
| deck_title | VARCHAR(255) |
| created_at | DATETIME |
| rounds_played | INT |
| average_accuracy | VARCHAR(10) |
| average_response_time | VARCHAR(10) |
| game_log_json | JSON |
| ai_summary_text | TEXT |
| ai_summary_paragraph1 | TEXT |
| ai_summary_paragraph2 | TEXT |
| ai_summary_paragraph3 | TEXT |

---

## API

The backend mostly serves HTML. JSON endpoints are limited to auth and game data.

### Page routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Login page |
| GET | `/dashboard` | Teacher dashboard |
| GET | `/game/play` | Unity WebGL player |
| GET | `/report/:id` | Game report |

### Data routes

**POST /api/login**
```json
{ "username": "...", "password": "..." }
```
Sets a session cookie on success.

**GET /api/decks**
```json
[ { "id": 1, "title": "Math 101", "content": { ... } } ]
```
Used by Unity to load questions before the game starts.

**POST /api/upload-log**
```json
{ "deckID": 1, "log": { ... } }
```
Triggered by Unity when the game ends. Saves the log and starts async LLM processing.
```json
{ "reportId": 101, "status": "PROCESSING" }
```

---

## Realtime (Photon PUN 2)

Teacher Client = Master Client. Student Client = Peer.

The Teacher client handles:
- Loading the deck
- Broadcasting round start
- Receiving answer events from students
- Calculating correctness and scores
- Sending round end results

---

## AI Report

The LLM must output exactly 3 paragraphs. The backend enforces this.

Input: the game log JSON uploaded by the Teacher client after the game ends.

If inference fails or takes over 60 seconds, the failure is stored and the report view shows a fallback message.

---

## Security Note

Security on this project is currently minimal. The architecture does not include robust security measures at this stage of development.

The primary focus is gameplay mechanics and real-time sync for the presentation. The system uses hardcoded credentials to bypass authentication during testing. We lack cross-site request forgery protection and strict environment routing.

If we want to be more secure for after the demo, you'll need to:
- Replace hardcoded logins with secure database authentication
- Add request validation middleware across the Node backend, React web app, and Unity client

---

## Repo Structure

```
Card-Clash-Repo/
├── app.js                  # Express server — routes, auth, API
├── data.js                 # Mock data layer (swap with MySQL queries later)
├── schema.sql              # MySQL schema and table definitions
├── package.json
├── .env                    # Local environment variables (not committed)
│
├── certs/                  # Auto-generated self-signed HTTPS cert
├── node_modules/           # Installed by npm install — do not edit
│
├── public/
│   ├── styles.css
│   ├── fonts/              # Andika font files
│   └── Unity/              # Unity WebGL build
│       ├── index.html
│       ├── Build/
│       └── TemplateData/
│
├── views/                  # EJS templates
│   ├── index.ejs           # Landing page
│   ├── login.ejs           # Teacher login
│   ├── dashboard.ejs       # Teacher dashboard
│   ├── deck.ejs            # Deck editor
│   ├── game.ejs            # Teacher game view
│   ├── student.ejs         # Student game view
│   ├── sessions.ejs        # Past sessions list
│   └── report.ejs          # Session report + AI summary
│
└── Documentation/
    ├── ARCHITECTURE.md
    ├── SRS.md
    └── Tasks1-3.docx
```

---

## Environment Variables (.env)

Create a `.env` file in the project root. It's already in `.gitignore` — never commit it.

```
SESSION_SECRET=your_super_secret_key   # signs the session cookie — change this to anything long and random
ADMIN_USERNAME=admin                   # teacher login username
ADMIN_PASSWORD=password                # teacher login password — change before any real deployment
NODE_ENV=development                   # set to "production" on the server (enables secure cookies)
```
