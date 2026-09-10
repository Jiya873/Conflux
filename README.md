# Real-Time Collaborative Editor

A real-time collaborative text editor that enables multiple users to edit the same document simultaneously with low-latency synchronization and reliable server-side state management.

Built with **React, Node.js, Socket.IO, Quill.js, Redis, and Docker**.

## Features

* **Real-time collaboration** — Multiple users can edit the same document simultaneously with changes synchronized through WebSockets.
* **Server-authoritative document state** — Incoming Quill Deltas are composed on the server before being broadcast to connected clients.
* **Operational Transform** — Uses Quill's Delta composition model to maintain consistent document state during concurrent edits.
* **Efficient persistence** — Document saves are triggered using a **2-second debounce**, reducing redundant Redis writes during active editing.
* **Redis caching & persistence** — Documents use namespaced keys with a **24-hour TTL** for automatic cleanup of inactive data.
* **Input validation** — Socket events validate document IDs, usernames, Deltas, and cursor ranges before processing.
* **Connection recovery** — Reconnecting clients automatically rejoin the document and reload the latest server state.
* **Docker support** — Frontend, backend, and Redis can be run together using Docker Compose.

## Architecture

```text
                    ┌───────────────────┐
                    │    React + Quill  │
                    │      Client A     │
                    └─────────┬─────────┘
                              │
                              │ Socket.IO
                              ▼
                    ┌───────────────────┐
                    │   Node.js Server  │
                    │                   │
                    │ Input Validation  │
                    │        ↓          │
                    │ Delta Composition │
                    │        ↓          │
                    │ Authoritative Doc │
                    └─────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
     ┌─────────────────┐             ┌─────────────────┐
     │  Socket.IO      │             │      Redis      │
     │ Broadcast Delta │             │ Document State  │
     └────────┬────────┘             │ 24h TTL         │
              │                      └─────────────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
┌─────────────┐ ┌─────────────┐
│  Client B   │ │  Client C   │
│ React+Quill │ │ React+Quill │
└─────────────┘ └─────────────┘
```

## How It Works

### 1. Client Editing

When a user modifies the document, Quill generates a **Delta** describing the change.

```text
User Edit
   ↓
Quill Delta
   ↓
Socket.IO
   ↓
Node.js Server
```

### 2. Server-Side Delta Composition

The server maintains an authoritative Delta for each active document.

Each incoming change is composed onto the current document state before being broadcast to other connected clients.

```text
Client A → Delta A ─┐
                    ├→ Server → Compose → Authoritative State
Client B → Delta B ─┘                         ↓
                                       Broadcast Changes
```

This prevents the server from acting as a simple relay and ensures persistence is based on the server's current document state.

### 3. Debounced Persistence

The server maintains a **2-second debounce timer per document**.

Every new edit resets the timer. Once editing becomes idle, the server initiates a save operation.

```text
Edit ─────┐
Edit ─────┤
Edit ─────┤── Reset Timer
Edit ─────┤
          └──── 2 sec idle → Save
```

This reduces unnecessary repeated persistence operations when several users are actively editing.

### 4. Redis Storage

Redis stores document state using namespaced keys:

```text
doc:{documentId}
users:{documentId}
```

Document writes refresh a **24-hour TTL**, allowing inactive documents to expire automatically.

### 5. Reconnection Handling

The client registers document initialization against the Socket.IO `connect` event.

When a connection is interrupted:

```text
Connection Lost
      ↓
Socket.IO Reconnect
      ↓
Rejoin Document
      ↓
Reload Current State
      ↓
Resume Editing
```

## Tech Stack

| Layer                   | Technology              |
| ----------------------- | ----------------------- |
| Frontend                | React                   |
| Editor                  | Quill.js                |
| Backend                 | Node.js                 |
| Real-Time Communication | Socket.IO               |
| Persistence             | Redis                   |
| Containerization        | Docker / Docker Compose |

## Project Structure

```text
real-time-editor-app/
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
├── server/
│   ├── index.js
│   ├── utils/
│   │   └── redisAPI.js
│   ├── package.json
│   └── ...
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

* Node.js
* npm
* Docker and Docker Compose

### Clone the Repository

```bash
git clone https://github.com/sergij14/real-time-editor-app.git
cd real-time-editor-app
```

### Run with Docker

```bash
docker-compose up --build
```

The application can then be accessed through the frontend service exposed by Docker.

### Run Locally

Install dependencies for both the frontend and server:

```bash
cd frontend
npm install
```

```bash
cd ../server
npm install
```

Start the backend and frontend using their respective npm scripts.

## Concurrency Model

The system uses a **server-authoritative model** rather than allowing clients to independently decide the final document state.

```text
                   Incoming Delta
                         │
                         ▼
                ┌─────────────────┐
                │ Validate Input  │
                └────────┬────────┘
                         ▼
                ┌─────────────────┐
                │ Compose Delta   │
                │ with Current    │
                │ Document State  │
                └────────┬────────┘
                         ▼
                ┌─────────────────┐
                │ Authoritative   │
                │ Document State  │
                └────────┬────────┘
                         ▼
                ┌─────────────────┐
                │ Broadcast to    │
                │ Connected Users │
                └─────────────────┘
```

