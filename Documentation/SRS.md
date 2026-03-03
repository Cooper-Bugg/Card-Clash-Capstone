# Software Requirements Specification (SRS) - Card Clash
1. Introduction
1.1 Purpose
The purpose of this document is to define the functional and non-functional requirements for "Card Clash," an educational party-style game. This system gamifies classroom assessments by allowing teachers to host competitive sessions where students utilize knowledge-based "battle" mechanics. The system uniquely integrates a Lightweight LLM (Ollama) to generate post-game performance summaries and identify student knowledge gaps.

1.2 Scope
The Card Clash system utilizes a Monolithic Architecture to minimize complexity. It consists of two primary interfaces served by a single backend:

Web Portal (Teacher Dashboard): A Server-Side Rendered (SSR) interface using EJS templates. This allows teachers to manage accounts, create quizzes, launch games, and view AI reports.

Game Client (Unity WebGL): A browser-based 2D game client hosted statically by the backend. This is where students join lobbies and play the game.

Backend Infrastructure:

Application Server: A single Node.js/Express application hosted on a local development server. It handles HTTP requests, serves the HTML dashboard, and manages the database.

Game Logic Authority: The Teacher's Unity Client acts as the "Host" for real-time logic, synchronized via Photon PUN 2.

Data Storage: MySQL using JSON-based storage for flexibility.

AI Module: An inference interface (Ollama) processing session logs to produce natural language feedback.

1.3 Definitions, Acronyms, and Abbreviations
Host/Master Client: The Teacher’s instance of the application, which holds authoritative game state (timer, score calculation) via PUN 2.

MVP: Minimum Viable Product (Target: 4 simultaneous players + 1 Host).

CCU: Concurrent Users.

PUN 2: Photon Unity Networking 2 (Middleware for multiplayer synchronization).

Ollama: Framework for running local Large Language Models (LLMs).

Local Development Server: The Node.js application serves on localhost with team access via local network IP.

---

## 2. Overall Description

### 2.1 Product Perspective

Card Clash is a unified web application. Unlike distributed systems that separate the frontend and backend codebases, Card Clash serves both the Dashboard and the Game Client from a single directory.

- **Real-time Gameplay**: Peer-to-Peer/Relay via Photon Cloud
- **Persistent Data**: Direct Server-to-Database communication via the Node.js application

### 2.2 Product Functions

- **Session Management**: The Host creates a lobby code; the system synchronizes game states across all connected clients
- **Assessment & Combat**: Student correctness on multiple-choice questions converts directly into "Action Points" or "Damage" in the game simulation
- **AI Analysis**: The system aggregates session logs (response times, accuracy per tag) to generate a "Class Summary" via LLM inference
- **Content Management**: Teachers can create, edit, and save quiz decks to the MySQL database

### 2.3 User Classes and Characteristics

- **Teacher (Admin/Host)**: Requires a desktop/laptop environment to act as the Master Client. Accesses the Dashboard to start games
- **Student (Player)**: Variable literacy. Accessing via low-power devices (Chromebooks). Requires a simplified, highly visual interface with minimal text input

### 2.4 Operating Environment

**Client Hardware:**
- **Teacher**: Laptop/Desktop with >8GB RAM (to support Host Unity instance + Browser)
- **Student**: Chromebooks (4GB RAM) or standard mobile devices

**Server Constraints:**
- Local Development Environment (Node.js runtime)
- MySQL (Database)

**Network:**
- HTTPS is required for the Unity WebGL build to function correctly
- Firewalls must allow outbound traffic on Port 443 (WSS/HTTPS) for Photon Cloud

---

## 3. Specific Requirements

### 3.1 Functional Requirements

#### 3.1.1 Authentication & Accounts

- **FR-1**: The system shall allow Teachers to register and log in using a username and password.
- **FR-2**: The Node.js backend shall use Session Cookies to maintain authenticated state across dashboard pages.
- **FR-3**: Students shall join game sessions via a 6-character alphanumeric "Room Code" without requiring account creation.

#### 3.1.2 Gameplay Mechanics (Unity/PUN)

- **FR-4 (Lobby)**: The Master Client shall broadcast a "Game Start" event that transitions all connected clients from the Lobby Scene to the Gameplay Scene
- **FR-5 (Lock-Step)**: The Master Client shall have the ability to control game progress at anytime; Pause, End, Restart, Kick Player.
- **FR-6 (Deck System)**: Students shall have the ability to purchase cards with the points they gain from answer questions.
- **FR-7 (Combat Logic)**: The Master Client (Teacher) shall automatically calculate player question scores based on answer correctness and speed, ensuring a single source of truth for scoring. (In some question set formats)
- **FR-8 (Combat Logic)**: The clients should automatically calculate question scores based on answer correctness and speed, for real-time dependent questions, like randomized mathematical equations. (In some question set formats)



#### 3.1.3 AI & Analytics

- **FR-9 (Data Collection)**: The Master Client shall upload a single JSON blob containing the full game log (Student Name, Questions, Timestamps, Scores) to the Node.js backend upon game completion.
- **FR-10 (Performance Summary)**: The backend shall transmit the JSON log to the LLM (Ollama) to generate a 3-paragraph natural language summary of class performance.
- **FR-11 (Review)**: The system shall store the raw metrics alongside the AI summary for historical review.

#### 3.1.4 Teacher Dashboard (Web Portal)

- **FR-12**: The Dashboard shall be rendered server side (EJS) and allow teachers to Create, Read, Update, and Delete (CRUD) quiz sets stored in the database
- **FR-13**: The Dashboard shall display a list of past sessions, allowing the teacher to click into them to view the stored AI Reports

#### 3.1.4 Game Details

- **FR-14**: The game shall include a welcome scene with the list of players in the lobby, the lobby code, and the start button.
- **FR-15**: The game shall include a round 1, where players answer as many questions as they can from the set in a certain time limit, or race to answer a set number of questions the fastest. 
- **FR-16**: The game shall include a round 2 shop interface that allows players to choose from a selection of cards.
- **FR-17**: The game shall include a round 2, where players can exchange their round 1 points for cards. (See functional requirement #6)
- **FR-18**: The game shall include a round 3, where players use their deck to battle against a boss or each other.


(Additional Requirements if time permits)
#### 3.1.5 Question Set Explore Page(Web page)

- **FR-19**: The explore page must pull public question sets that teachers have created, and display those in a nice format for teachers to use in their own game.
- **FR-20**: The explore page must have a "Trending" section of popularly used question sets.


### 3.2 Non-Functional Requirements

#### 3.2.1 Performance & Reliability

- **NFR-1 (Latency)**: Gameplay actions must synchronize across all MVP clients within 200ms via Photon Cloud
- **NFR-2 (Memory)**: The Student Unity WebGL build must not exceed 250MB (Heap) to prevent crashing Chrome tabs on Chromebooks
- **NFR-3 (AI Latency)**: LLM inference for the post-game summary must complete within 60 seconds of the log upload

#### 3.2.2 Scalability (MVP Constraints)

- **NFR-4**: The system architecture shall support a minimum of 5 concurrent connections (1 Host + 4 Students) for the Capstone MVP

#### 3.2.3 Security

- **NFR-5**: Passwords shall be hashed (e.g., bcrypt) before storage in the MySQL database
- **NFR-6**: The API shall validate that only the authenticated Session Owner (Teacher) can trigger a game log upload

---

## 4. System Interface Requirements

### 4.1 Communication Interfaces

- **Unity-to-Unity**: Photon User Datagram Protocol (UDP) or WebSocket Secure (WSS) via Photon Cloud for gameplay data
- **Unity-to-Backend**: HTTP/REST requests for fetching Quiz Data (GET) and uploading Game Logs (POST)
- **Browser-to-Backend**: Standard HTTP navigation for the Dashboard; Form submissions for Login and Quiz Editing

### 4.2 Software Interfaces

- **Database**: MySQL (utilizing JSON columns for storage)
- **AI Engine**: Ollama API
- **Web Server**: Express.js (Node.js) serving both static assets and dynamic views