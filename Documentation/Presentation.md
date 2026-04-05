# Card Clash Presentation

Card Clash is an educational party game designed for real time classroom environments. A teacher hosts a session through a web dashboard where they manage question decks and start game sessions. When a session begins the platform generates a short join code that students use to connect from their own devices through a browser. Once connected, students participate in the game in real time. Questions are delivered simultaneously to all players and their responses are tracked throughout the session, allowing teachers to run interactive review sessions while also collecting performance data.

The system uses a hybrid architecture. The teacher tools and account management features run on a Node.js server, while the gameplay itself runs inside a Unity WebGL client embedded directly in the browser. This separation allows the management platform and the game engine to operate independently while still communicating through the backend server.
---

## Core Dependencies and Technology Stack

- **Backend:** Node.js server with Express for API routing
- **Frontend:** Web dashboard using EJS templates which are rendered server-side
- **Game Client:** Unity, exported as WebGL
- **Multiplayer:** Photon PUN 2 for real-time synchronization
- **Database:** MySQL for data persistence
- **AI:** Large Language Model for data summarization
- **Security:** HTTPS required for Unity WebGL Brotli-compressed assets

---

## Technical Progress

### Web Frontend and Dashboard

The web interface provides teachers with a complete account and session management system. It acts as the central control panel where teachers create question decks, manage sessions, and review results. The frontend uses Server-Side Rendering through the Node.js backend with EJS templates, meaning the server generates the full HTML pages before sending them to the browser. This approach keeps authentication and session data handled securely on the server while also allowing pages to load quickly and consistently.

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

**UI/UX features:**

These interface improvements focus on usability and consistency across the platform so teachers can navigate the dashboard quickly while setting up or managing a session.

- Responsive layouts so dashboard, deck editor and Unity WebGL resize cleanly across various devices and screen sizes
- Consistent high-contrast panel text and accessible color to ensure legibility in both light and dark themes
- Tactile buttons and micro-interactions: hover, focus and active states with subtle transitions and visible keyboard focus outlines for clear feedback
- Compact, accessible button layouts on auth pages implemented with flex grids, adequate hit targets and spacing for touch devices

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
