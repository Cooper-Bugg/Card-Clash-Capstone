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

The web interface provides teachers with a dashboard to manage decks and review past sessions. The frontend relies on Server-Side Rendering served by the Node.js backend. This approach ensures rapid initial page loads and secure session management. The web views include deck editors, past session lists, and detailed report pages.

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

The Node.js server handles routing, authentication, and data proxying. The backend serves HTML pages and exposes specific JSON endpoints for data operations:

| Endpoint | Description |
|----------|-------------|
| `POST /api/login` | Authenticates users and sets session cookies |
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
