# Card Clash Presentation

Card Clash is an educational party game designed for real-time classroom environments. A teacher hosts a session via a web dashboard and students join using a short code. The system relies on a hybrid architecture combining a web-based management platform with a Unity WebGL game client.

---

## Core Dependencies and Technology Stack

- **Backend:** Node.js server with Express for API routing
- **Frontend:** Web dashboard using Server-Side Rendering (EJS templates)
- **Game Client:** Unity, exported as WebGL
- **Multiplayer:** Photon PUN 2 for real-time synchronization
- **Database:** MySQL for data persistence
- **AI:** Large Language Model for data summarization
- **Security:** HTTPS required for Unity WebGL Brotli-compressed assets

---

## Technical Progress

### Web Frontend and Dashboard

The web interface provides teachers with a complete account and session management system. The frontend relies on Server-Side Rendering served by the Node.js backend, ensuring rapid initial page loads and secure session management.

**Implemented pages:**
- **Landing Page** (`/`) — Role selector: Student or Teacher
- **Teacher Portal** (`/teacher`) — Intermediate landing page with Sign In and Create Account options
- **Login** (`/login`) — Authenticates teachers via session cookies
- **Registration** (`/register`) — Creates new teacher accounts (ready for database integration)
- **Dashboard** (`/dashboard`) — Lists all decks and recent sessions
- **Deck Editor** (`/deck/new`, `/deck/:id/edit`) — Full question editor with math generator
- **Sessions** (`/sessions`) — Browsable list of all past game sessions
- **Report** (`/report/:id`) — AI summary and class metrics for a given session
- **Game View** (`/game/play`) — Hosts the Unity WebGL game client in-browser
- **Student View** (`/join`) — Student-facing Unity game client

**UI/UX features shipped:**
- System-wide **dark mode** with localStorage persistence across all pages
- All panel text uses hardcoded colors to maintain contrast in both light and dark themes
- Operator selection in the math generator defaults to unchecked (user must choose)
- Compact button layouts on auth pages using flex grids

### Deck Builder and Math Generator

The deck editor supports three question types: Multiple Choice, True/False, and Fill in the Blank. A built-in math question generator allows teachers to rapidly populate a deck with randomized arithmetic problems.

**Math Generator features:**
- **Select Operators** — Choose any combination of `+`, `−`, `×`, `÷`
- **Number Range** — Configure minimum and maximum operand values
- **Question Count** — Generate 1–50 questions at once
- **Allow Negative Answers** — Optional toggle; when disabled, subtraction operands are automatically swapped to prevent negative results
- **Live Preview** — Shows the first 5 generated questions before committing to the deck

### Unity WebGL Game Client

The core gameplay executes within the browser via a Unity WebGL build. The server delivers compressed assets to optimize load times. The Unity client acts as the authoritative host for game logic. The teacher client validates answers, calculates scores, and manages round timing. This design places trust on the teacher client for the Minimum Viable Product.

### Real-Time Synchronization

- **Photon Cloud:** Multiplayer networking
- **Teacher Unity Client:** Master Client
- **Student Clients:** Peers
- **Gameplay State:** Managed by Unity application
- **Node.js Backend:** Interacts only at session conclusion to upload final log

---

## Backend and API Architecture

The Node.js server handles routing, authentication, and data proxying. The backend serves HTML pages via EJS and exposes JSON endpoints for game data and AI processing.

**Web Routes (Browser)**

| Route | Description |
|-------|-------------|
| `GET /` | Landing page — role selector |
| `GET /teacher` | Teacher portal (Sign In / Create Account) |
| `GET /login` | Teacher login form |
| `POST /login` | Authenticate and set session cookie |
| `GET /register` | New account registration form |
| `POST /register` | Submit new account (ready for DB hookup) |
| `GET /dashboard` | Teacher dashboard — decks and sessions |
| `GET /deck/new` | Create a new deck |
| `GET /deck/:id/edit` | Edit an existing deck |
| `POST /deck` | Save deck to data store |
| `GET /sessions` | All past game sessions |
| `GET /report/:id` | View AI summary and metrics |
| `GET /game/play?deckID=1` | Launch Unity WebGL game (Teacher) |
| `GET /join` | Student game view |

**JSON API Routes**

| Endpoint | Description |
|----------|-------------|
| `GET /api/decks` | Retrieves question data for the Unity client |
| `POST /api/upload-log` | Receives the game log from Unity and triggers asynchronous AI processing |

---

## Database Design

Data persistence relies on a MySQL relational database optimized for the current project scope. The schema includes tables for users, decks, and sessions. The design incorporates JSON columns for deck content and game logs. This strategy avoids complex table joins and simplifies data retrieval for final report generation.

---

## Artificial Intelligence Integration

The system employs a Large Language Model to process gameplay data. When a game ends, the Unity client uploads the session log to the backend. The backend submits this JSON payload to the AI model to generate a structured performance summary.

- **Output Constraint:** Three-paragraph summary
- **Timeout:** Completion required within sixty seconds
- **Error Handling:** Fallback message provided in report view if inference fails or times out
