# MorrowMesh — Emergency Mesh & Disaster Coordination

> "When the network fails, the people become the network."
>
> Team HackShastra // Round 2 Submission

## Project Overview

MorrowMesh is an offline-first emergency communication and disaster coordination platform designed for crisis scenarios where traditional cellular and broadband networks fail. The platform enables citizens to report emergencies, relay information through nearby devices, sync critical data via gateways, and help command centers triage incidents effectively in real time.

This project simulates a resilient emergency mesh network using browser-based local communication, offline persistence, and a lightweight backend.

## Problem Statement

During natural disasters such as floods, earthquakes, hurricanes, and infrastructure failures, centralized communication systems often fail first. In these situations:

- People cannot reach emergency services reliably
- Existing communication networks are unreliable or unavailable
- Response teams need a fast way to understand urgent incidents and zone-level impact
- Critical reports can be lost if devices have no internet connectivity at the moment they are created

MorrowMesh addresses this challenge by creating a decentralized, offline-first communication pipeline that continues to function without a stable network connection.

## Key Features

- Offline-first emergency reporting from the origin node
- Peer-to-peer relay via mesh-style store-and-forward communication
- Local deduplication and duplicate suppression to prevent repeated packets
- IndexedDB persistence for resilient offline storage
- Gateway-based synchronization to the backend when connectivity returns
- FastAPI backend for validation, ingestion, and incident aggregation
- Incident command dashboard for triage, prioritization, and status updates
- Topology view showing message flow and relay path across the mesh network
- Priority-based dispatch tracking: CRITICAL, HIGH, MEDIUM, LOW

## System Flow

1. Citizen creates an emergency report from the Origin Node (/send)
2. The report is stored locally and queued for offline transmission
3. Relay nodes forward the message through nearby devices using a mesh transport layer
4. Gateway nodes detect connectivity and batch-sync data to the backend
5. Central command creates a unified incident view and prioritizes response actions

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- CSS (custom tactical dark UI)
- Lucide icons
- IndexedDB for offline storage

### Backend
- Python
- FastAPI
- Pydantic
- Uvicorn
- JSON-based persistence for message data

### Communication / Mesh Model
- Browser BroadcastChannel abstraction
- Store-and-forward relay model
- Local duplicate filtering and message audit history

## Project Structure

```bash
.
├── README.md
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── data/
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.*
├── render.yaml
└── .gitignore
```

## Application Routes

- `#/send` — Origin SOS Node
- `#/node` — Relay Courier Node
- `#/gateway` — Gateway Uplink Node
- `#/command` — Incident Command HQ

## How to Run the Project

### 1) Backend Setup

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

Access the backend at:
- API: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`
- API docs: `http://127.0.0.1:8000/docs`

### 2) Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open the app at:
- `http://localhost:5173/`

## Demo / Usage Details

A typical demo workflow is:

1. Open the frontend and go to the Origin Node page
2. Create a disaster report with location, casualties, and priority
3. Simulate a relay through the Courier Node to show message forwarding
4. Use the Gateway page to sync data to the backend
5. Go to Command HQ to view aggregated incident data and priority queue
6. Validate that statuses can be updated and topology information is derived from message history

## Screenshots / Demo Notes

This project is designed for a live demonstration during evaluation. The interface includes role-based pages for:
- emergency report generation,
- relay buffering and forwarding,
- gateway synchronization,
- command-center dispatch visualization.

If screenshots are required for the final submission, they can be added to the repository or included in the presentation deck showing the flow from `/send` to `/command`.

## Team Members

- Team HackShastra
- Rudra Pratap Singh

## Project Status

This repository represents the final Round 2 submission for MorrowMesh and demonstrates an end-to-end offline emergency coordination workflow using a browser-first mesh model and backend processing layer.

---

MorrowMesh was built to show how resilient, decentralized communication can help maintain situational awareness in disaster scenarios when traditional infrastructure fails.
