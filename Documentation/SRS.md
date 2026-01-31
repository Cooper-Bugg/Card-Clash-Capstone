# Software Requirements Specification (SRS) - Card Clash
1. Introduction
1.1 Purpose
The purpose of this document is to define the functional and non-functional requirements for "Card Clash," an educational party-style game. This system gamifies classroom assessments by allowing teachers to host competitive sessions where students utilize knowledge-based "battle" mechanics. The system uniquely integrates a Lightweight LLM (e.g., Ollama) to generate post-game performance summaries, identify student knowledge gaps, and provide question-generation assistance.

1.2 Scope
The Card Clash system consists of three distinct subsystems:

Teacher Dashboard (Web Client): A React-based interface for account management, quiz creation, lobby control, and AI analytics review.

Student Client (Unity WebGL): A browser-based 2D game client where students join lobbies, customize decks, answer questions, and execute battle commands.

Backend Infrastructure:

Game Logic: Synchronized via Photon PUN 2 (Unity) with the Teacher's client acting as the "Master Client" authority.

Persistence & API: A Node.js/Express application hosted on OSU Servers (Linux) managing user accounts and database transactions.

Data Storage: MySQL database for relational data (users, quizzes, logs).

AI Module: An inference interface (Ollama) processing session logs to produce natural language feedback.

1.3 Definitions, Acronyms, and Abbreviations
Host/Master Client: The Teacher’s instance of the application, which holds authoritative game state (timer, score calculation) via PUN 2.

MVP: Minimum Viable Product (Target: 4 simultaneous players + 1 Host).

CCU: Concurrent Users.

PUN 2: Photon Unity Networking 2 (Middleware for multiplayer synchronization).

Ollama: Framework for running local Large Language Models (LLMs).

OSU Server: The university-provided Linux hosting environment (HTTP only).

---

## 2. Overall Description

### 2.1 Product Perspective

Card Clash is a hybrid web/game application. Unlike standard quiz tools (e.g., Kahoot), it decouples the "Question Phase" from the "Action Phase," allowing for strategic deck-building gameplay. It operates on a split-topology:

- **Real-time Gameplay**: Peer-to-Peer/Relay via Photon Cloud
- **Persistent Data**: Client-Server via REST API (Node.js)

### 2.2 Product Functions

- **Session Management**: The Host creates a lobby code; the system synchronizes game states (Lobby → Quiz → Battle → Results) across all connected clients
- **Assessment & Combat**: Student correctness on multiple-choice questions converts directly into "Action Points" or "Damage" in the game simulation
- **AI Analysis**: The system aggregates session logs (response times, accuracy per tag) to generate a "Class Summary" and individual "Student Metrics" via LLM inference
- **Content Management**: Teachers can create, edit, and save quiz decks to the MySQL database

### 2.3 User Classes and Characteristics

- **Teacher (Admin/Host)**: Low-to-high technical literacy. Requires a desktop/laptop environment (Windows/Mac) to act as the Master Client
- **Student (Player)**: Variable literacy. Accessing via low-power devices (Chromebooks). Requires a simplified, highly visual interface with minimal text input

### 2.4 Operating Environment

**Client Hardware:**
- **Teacher**: Laptop/Desktop with >8GB RAM (to support Host Unity instance + React Dashboard)
- **Student**: Chromebooks (4GB RAM) or standard mobile devices

**Server Constraints:**
- OSU Student Server (Linux, Limited CPU/RAM)

**Network:**
- HTTPS (GitHub Pages) for Frontend; HTTP (OSU Server) for Backend
- Note: Requires CORS configuration or Proxy to prevent Mixed Content errors

---

## 3. Specific Requirements

### 3.1 Functional Requirements

#### 3.1.1 Authentication & Accounts

- **FR-1**: The system shall allow Teachers to register and log in using a unique email and password
- **FR-2**: The Node.js backend shall issue a secure token (JWT) upon successful login to maintain session state for the Dashboard
- **FR-3**: Students shall join game sessions via a 4-6 character alphanumeric "Room Code" without requiring permanent account creation

#### 3.1.2 Gameplay Mechanics (Unity/PUN)

- **FR-4 (Lobby)**: The Master Client shall broadcast a "Game Start" event that transitions all connected clients from the Lobby Scene to the Gameplay Scene
- **FR-5 (Lock-Step)**: The system shall enforce a synchronized state machine; no student may advance to the "Battle Phase" until the Host closes the "Question Phase"
- **FR-6 (Deck System)**: Students shall be able to select a pre-defined "Deck" (Avatar/Card Set) prior to the match start
- **FR-7 (Combat Logic)**: The Master Client shall calculate damage values based on:
  - Correctness of the answer
  - Speed of the answer (optional multiplier)
  - Card stats associated with the student's chosen deck

#### 3.1.3 AI & Analytics

- **FR-8 (Data Collection)**: The Master Client shall export a JSON log of the session (Student Name, Question ID, Time_to_Answer, Correct/Incorrect) to the Node.js backend upon game completion
- **FR-9 (Performance Summary)**: The backend shall transmit session logs to the LLM (Ollama) to generate a 3-paragraph natural language summary of class performance
- **FR-10 (Tutoring/Review)**: The system shall identify the "Most Missed Question" and prompt the LLM to generate a brief explanation/tutoring tip for that specific topic

#### 3.1.4 Teacher Dashboard (React)

- **FR-11**: The Dashboard shall allow teachers to Create, Read, Update, and Delete (CRUD) quiz sets stored in the MySQL database
- **FR-12**: The Dashboard shall display historical session data fetched from the backend

### 3.2 Non-Functional Requirements

#### 3.2.1 Performance & Reliability

- **NFR-1 (Latency)**: Gameplay actions (e.g., locking in an answer) must synchronize across all 4 MVP clients within 200ms under normal network conditions
- **NFR-2 (Memory)**: The Student Unity WebGL build must not exceed 250MB (Heap) to prevent crashing Chrome tabs on Chromebooks
- **NFR-3 (AI Latency)**: LLM inference for the post-game summary must complete within 60 seconds

#### 3.2.2 Scalability (MVP Constraints)

- **NFR-4**: The system architecture shall support a minimum of 5 concurrent connections (1 Host + 4 Students) for the Capstone MVP demonstration

#### 3.2.3 Security

- **NFR-5**: Passwords shall be hashed (e.g., bcrypt) before storage in the MySQL database
- **NFR-6**: The API shall validate all incoming data to prevent SQL Injection attacks

---

## 4. System Interface Requirements

### 4.1 Communication Interfaces

- **Unity-to-Unity**: Photon User Datagram Protocol (UDP) or WebSocket Secure (WSS) via Photon Cloud for gameplay data
- **Unity-to-Backend**: HTTP/REST requests for fetching Quiz Data (JSON) and uploading Game Logs
- **React-to-Backend**: HTTP/REST requests for User Authentication and History management

### 4.2 Software Interfaces

- **Database**: MySQL 8.0+
- **AI Engine**: Ollama API (Compatible with OpenAI Chat Completion Schema)
- **Web Server**: Nginx or Apache (OSU Server default) acting as a reverse proxy for the Node.js application