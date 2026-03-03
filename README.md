# Card Clash — Senior Capstone Project

Card Clash is an educational party game. A teacher hosts a session and students join with a short code. Gameplay runs in real time via Photon Cloud. When the game ends, the Teacher client uploads the game log and the backend generates a 3-paragraph AI summary.

**To run locally:** Navigate to `Backend/` (where `app.js` is located — our Node.js/Express server), then run:

```bash
cd Backend
npm install
npm start
```

Open `https://localhost:3000` in your browser. No database required for local development.

---

## Features

### Deck Builder
Teachers can create and edit flashcard decks with three question types:
- **Multiple Choice** — four answer options, one correct answer
- **True / False** — students pick true or false
- **Fill in the Blank** — students type the correct answer

### Basic Math Generator
The deck builder includes a built-in math question generator. Select the operators you want (`+`, `−`, `×`, `÷`), set a number range and how many questions to generate, then click **Generate Math Deck**. The generator creates randomized math problems with plausible distractors for multiple choice, or correct/incorrect statements for true/false.

**Features:**
- **Operator Selection** — Choose which operations to include (addition, subtraction, multiplication, division)
- **Number Range** — Set minimum and maximum values for generated numbers
- **Negative Answers** — Optional checkbox to allow negative results in subtraction (default: disabled, automatically swaps operands to avoid negatives)
- **Question Count** — Generate 1-50 questions at once
- **Preview** — See a sample of generated questions before adding them to your deck

### AI Question Generation *(Coming Soon)*
AI-powered question generation will allow teachers to describe a topic and have the system automatically produce a full deck of quiz questions. This feature is planned for a future release.

### AI Session Reports
After each game session, the backend sends the game log to an LLM and generates a 3-paragraph summary covering performance, trends, and next steps. Reports are available in the Sessions view.

### Dark Mode
Full dark mode support across all pages with a toggle button. Dark mode preference is saved to browser localStorage and persists across sessions. All UI elements, including panels, buttons, and text, maintain proper contrast and readability in both light and dark themes.

### Teacher Account Management
- **Landing Page** — Choose between Student or Teacher role
- **Teacher Portal** — Sign in or create a new account
- **Registration** — New teachers can create accounts with username, email, and password
- **Authentication** — Session-based login with secure logout

---

## Known Bugs

### Math Generator
- **Input Focus Glow Clipping** — The focus outline/glow on input fields (e.g., "Lowest Number") renders partially under the side padding of the math generator panel. The glow should appear fully on top of the panel boundaries. *(Note: `overflow: visible` has been added but may need additional z-index or padding adjustments)*

### General
- *Add known bugs here as they are discovered*

---

## Setup

### Prerequisites

- **Node.js** — [nodejs.org](https://nodejs.org/) (LTS recommended)
- **MySQL** — only needed if working on database integration (see [Database Setup](#database-setup-mysql))

### Install and run

Navigate to the `Backend/` directory (where `app.js` is located — our Node.js/Express server) and install dependencies:

```bash
cd Backend
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

The Unity build is already in `Frontend/public/Unity/`. If you export a new build, drop the files there — it needs an `index.html` at the root. The server serves it at `/Unity/index.html` and handles Brotli-compressed assets (`.wasm.br`, `.js.br`, `.data.br`) automatically.

### Database Setup (MySQL)

The app uses mock data in `Backend/mockdata.js` by default and runs without a database. Only do this if you're working on database integration.

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
- **Hosting** — Dashboard + API on OSU Node.js server, DB on OSU MySQL. Unity WebGL served statically from `Frontend/public/Unity/`.

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
| GET | `/` | Landing page — role selector |
| GET | `/teacher` | Teacher portal (Sign In / Create Account) |
| GET | `/login` | Teacher login form |
| POST | `/login` | Authenticate and set session cookie |
| GET | `/register` | New account registration |
| POST | `/register` | Submit new account |
| GET | `/dashboard` | Teacher dashboard |
| GET | `/sessions` | All past game sessions |
| GET | `/report/:id` | Game report + AI summary |
| GET | `/deck/new` | Create a new deck |
| GET | `/deck/:id/edit` | Edit an existing deck |
| POST | `/deck` | Save deck |
| GET | `/game/play` | Unity WebGL game view (Teacher) |
| GET | `/join` | Unity WebGL game view (Student) |

### Data routes

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

**POST /api/ai/summarize** — Triggers Ollama AI analysis (stub, not yet connected)

**GET /api/ai/report/:sessionID** — Returns cached AI report for a session

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
- Add request validation middleware across the Node backend, EJS views, and Unity client

---

## Repo Structure

```
Card-Clash-Repo/
├── Backend/                # Node.js/Express server
│   ├── app.js              # Main server file — routes, auth, API
│   ├── database.js         # MySQL connection pool (ready, not active)
│   ├── database.sql        # MySQL schema and table definitions
│   ├── mockdata.js         # Mock data layer (currently active)
│   ├── package.json        # Node dependencies
│   └── node_modules/       # Installed by npm install — do not edit
│
├── Frontend/
│   ├── public/
│   │   ├── styles.css      # Main stylesheet with dark mode support
│   │   ├── darkmode.js     # Dark mode toggle logic with localStorage
│   │   ├── fonts/          # Andika font files
│   │   │   └── Andika/     # TTF files for all weights
│   │   └── Unity/          # Unity WebGL build
│   │       ├── index.html
│   │       └── Build/
│   │           ├── WebGL_Dev_Build.data
│   │           ├── WebGL_Dev_Build.framework.js
│   │           ├── WebGL_Dev_Build.loader.js
│   │           └── WebGL_Dev_Build.wasm
│   │
│   └── views/              # EJS templates
│       ├── index.ejs       # Landing page (Student vs Teacher)
│       ├── teacher.ejs     # Teacher portal (Sign In / Create Account)
│       ├── login.ejs       # Teacher sign in
│       ├── register.ejs    # Teacher registration
│       ├── dashboard.ejs   # Teacher dashboard
│       ├── deck.ejs        # Deck editor with math generator
│       ├── game.ejs        # Teacher game view
│       ├── student.ejs     # Student game view
│       ├── sessions.ejs    # Past sessions list
│       └── report.ejs      # Session report + AI summary
│
├── certs/                  # Auto-generated self-signed HTTPS cert
│   ├── localhost-cert.pem
│   └── localhost-key.pem
│
├── Documentation/
│   ├── ARCHITECTURE.md
│   ├── SRS.md
│   ├── Presentation.md
│   ├── Tasks1-3.docx
│   └── Market_Research/
│
├── .env                    # Local environment variables (not committed)
├── .gitignore
├── LICENSE
└── README.md
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
