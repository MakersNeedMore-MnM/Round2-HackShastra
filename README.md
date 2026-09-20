# MorrowMesh — Emergency Mesh & Disaster Coordination

> **“When the network fails, the people become the network.”**
>
> An offline-first emergency communication and disaster coordination platform built for **Morrow 1.0 Round 2 by Makers Need More (MnM)**.

**Team:** HackShastra  
**Team member:** Rudra Pratap Singh

[![Live Frontend](https://img.shields.io/badge/Live%20Frontend-Vercel-black?logo=vercel)](https://frontend-two-lime-h6f34t9yga.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](http://127.0.0.1:8000)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-3178C6?logo=typescript)](https://react.dev/)

## Problem Statement

During floods, earthquakes, storms, infrastructure failures, and other disasters, internet and cellular connectivity may become unavailable or unreliable. People in distress still need a way to report emergencies, while responders need an organized view of incidents and their urgency.

Traditional centralized systems can fail at the moment they are needed most. Emergency reports may also be lost when a device cannot immediately reach a server.

## Solution

**MorrowMesh** provides a browser-first, offline-capable emergency coordination workflow:

1. A person creates a one-tap SOS message.
2. The message is persisted locally on the device.
3. A relay node can buffer and forward the message.
4. A gateway synchronizes pending messages when connectivity becomes available.
5. The FastAPI backend validates and aggregates the data.
6. Command HQ presents active incidents, statuses, priorities, and recorded message paths.

The current browser MVP uses **IndexedDB** for offline persistence and **BroadcastChannel** as the local mesh transport abstraction. It does **not** currently claim universal Bluetooth mesh, Wi-Fi Direct mesh, or automatic emergency-service dispatch.

## Key Features

### 1. One-Tap Emergency SOS

- Mobile-first emergency interface.
- SOS creation without requiring a long form.
- Optional emergency details for faster reporting.
- Local persistence of emergency messages.
- Browser location attachment when available.
- Designed to minimize interaction during stressful situations.

### 2. Store-and-Forward Relay

- Local message buffering while connectivity is unavailable.
- BroadcastChannel-based transport abstraction.
- Duplicate message detection.
- Hop counting and hop audit history.
- Messages remain available locally until synchronization succeeds.

### 3. Gateway Synchronization

- Inspection of pending emergency messages.
- Batch synchronization through `POST /api/sync`.
- Backend ingestion when connectivity is available.
- Failed synchronization does not silently delete local messages.

### 4. FastAPI Backend

- Request and message validation.
- Global message deduplication.
- Server-side timestamps.
- Incident aggregation by zone.
- Incident status updates.
- Mesh topology extraction.
- JSON persistence for the current MVP.

### 5. Command HQ

- Active incident monitoring.
- Zone-based incident aggregation.
- Priority and people-affected information.
- Incident workflow: **Processed → Dispatched → Resolved**.
- Mesh topology visualization based on recorded message paths.

### 6. Mesh Topology

- Displays recorded message paths.
- Uses hop audit information collected during relay.
- Demonstrates the flow:

```text
Origin → Relay → Gateway → Command HQ
```

## How It Works

```text
PERSON IN DISTRESS
        ↓
    SEND SOS
        ↓
 STORED LOCALLY
        ↓
   RELAY NODE
        ↓
    GATEWAY
        ↓
 FASTAPI BACKEND
        ↓
  COMMAND HQ
```

The browser MVP models the mesh workflow through the `IMeshTransport` abstraction. The current implementation uses the browser `BroadcastChannel` API for local transport and IndexedDB for durable client-side storage.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Vanilla CSS, Lucide Icons |
| Offline storage | IndexedDB, `idb` |
| Mesh transport | BroadcastChannel API, `IMeshTransport` abstraction |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Backend persistence | JSON persistence for the current MVP |

## Application Routes

| Route | Purpose |
|---|---|
| `#/send` | Citizen emergency SOS interface |
| `#/node` | Relay node for buffering and forwarding messages |
| `#/gateway` | Gateway inspection and backend synchronization |
| `#/command` | Incident Command HQ for monitoring and status management |

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Check backend availability |
| `POST` | `/api/sync` | Batch-sync pending emergency messages |
| `GET` | `/api/messages` | Retrieve ingested emergency messages |
| `GET` | `/api/incidents` | Retrieve aggregated incidents |
| `PATCH` | `/api/messages/{message_id}/status` | Update an emergency message status |
| `GET` | `/api/topology` | Retrieve recorded mesh topology information |
| `POST` | `/api/reset` | Reset MVP backend data for demonstrations |

## Running Locally

### Prerequisites

- Python 3.10 or newer recommended.
- Node.js and npm.
- A modern browser with IndexedDB and BroadcastChannel support.

### 1. Start the Backend

From the repository root:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

Backend URLs:

- Base URL: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`
- Interactive API docs: `http://127.0.0.1:8000/docs`

### 2. Start the Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the application at:

```text
http://localhost:5173/
```

## Demo Scenario

Use the following scenario to demonstrate the complete workflow:

| Field | Example |
|---|---|
| Location | Bridge Zone |
| Emergency type | RESCUE |
| People affected | 3 |
| Situation | 3 people trapped near the bridge. One child injured. Water level rising fast. |

### Demo Flow

```text
SEND SOS
   → STORED LOCALLY
   → RELAY NODE
   → GATEWAY
   → SYNC TO HQ
   → COMMAND HQ
```

Suggested demonstration steps:

1. Open `#/send` and create an SOS for **Bridge Zone**.
2. Select **RESCUE** and set **People affected** to `3`.
3. Add the situation: “3 people trapped near the bridge. One child injured. Water level rising fast.”
4. Confirm that the message is stored locally.
5. Open `#/node` to demonstrate relay handling and hop information.
6. Open `#/gateway` and synchronize pending messages with the local backend.
7. Open `#/command` to view the incident, update its status, and inspect the topology.

## Live Demo

The frontend is publicly deployed at:

**[Open the MorrowMesh Live Frontend](https://frontend-two-lime-h6f34t9yga.vercel.app)**

The FastAPI backend is currently intended for **local demonstration and testing**. No public production backend URL is claimed.

## Verification and Testing

The project has been verified for:

- TypeScript compilation.
- Production frontend build.
- Python compilation.
- Offline SOS persistence.
- Relay message handling.
- Gateway synchronization.
- Backend ingestion.
- Message deduplication.
- Incident aggregation.
- Status updates.
- Mesh topology generation.
- Backend persistence.
- Preservation of local messages when synchronization fails.

## Current MVP Scope and Technical Honesty

MorrowMesh demonstrates an offline-first coordination workflow in a browser environment. In the current MVP:

- IndexedDB provides local browser persistence.
- BroadcastChannel provides the local mesh transport abstraction.
- Gateway synchronization is initiated through the application.
- The backend uses JSON persistence rather than a production database.
- The system does not automatically dispatch emergency services.
- The browser MVP does not provide universal Bluetooth or Wi-Fi Direct mesh networking.

These boundaries keep the current implementation technically accurate while leaving a clear path for future native integrations.

## Future Scope

Potential future improvements include:

- Native Bluetooth Low Energy transport.
- Wi-Fi Direct or other device-to-device transports.
- Background synchronization and service-worker integration.
- Encrypted and authenticated message transport.
- Conflict resolution for concurrent updates.
- Durable production database storage.
- Role-based access control for responders and administrators.
- Media attachments and richer incident evidence.
- Location-aware maps and geofencing.
- Integration with verified emergency-service workflows.
- Delivery acknowledgements and improved reliability metrics.

## Team

**HackShastra**

- Rudra Pratap Singh

## Hackathon

**Morrow 1.0 Round 2** by **Makers Need More (MnM)**

Repository: [MakersNeedMore-MnM/Round2-HackShastra](https://github.com/MakersNeedMore-MnM/Round2-HackShastra)

## License

No explicit open-source license is currently declared in this repository. The project is presented as a hackathon submission for evaluation and demonstration.
