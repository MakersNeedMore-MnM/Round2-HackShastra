# MorrowMesh — Emergency Mesh & Disaster Coordination

> "When the network fails, the people become the network."
>
> Offline-first emergency communication and disaster coordination for **Morrow 1.0 Round 2** by **Makers Need More (MnM)**.

**Team:** HackShastra  
**Team member:** Rudra Pratap Singh

## Live Application

The frontend is already deployed on **Vercel** and can be accessed directly without running the frontend locally:

### [Open MorrowMesh on Vercel](https://frontend-two-lime-h6f34t9yga.vercel.app)

[![Live Frontend](https://img.shields.io/badge/Live%20Frontend-Vercel-black?logo=vercel)](https://frontend-two-lime-h6f34t9yga.vercel.app)

> The FastAPI backend is currently available for local demonstration and testing. No public production backend URL is claimed.

## Project Overview

**MorrowMesh** is an offline-first emergency communication and disaster coordination platform designed for situations where normal internet or cellular connectivity is unavailable. The system allows emergency messages to be created and stored locally, relayed among participating nodes, synchronized through a gateway when connectivity becomes available, and displayed in a Command HQ interface.

This MVP is built for a browser environment and demonstrates how a resilient local mesh can help preserve critical situational awareness when traditional communication infrastructure fails.

## Problem Statement

During floods, earthquakes, storms, infrastructure failures, and other emergencies, internet and cellular connectivity may become unavailable or unreliable. In these conditions:

- People in distress may not be able to contact emergency services.
- Critical reports can be lost if a device is offline at the moment the incident occurs.
- Response teams need a fast way to understand urgent incidents and zone-level impact.
- Traditional centralized systems can fail exactly when they are needed most.

MorrowMesh addresses this challenge by creating an offline-first communication pipeline that continues to work even without a stable network connection.

## Solution

MorrowMesh combines a local-first emergency reporting flow with relay and gateway-based synchronization:

1. A citizen creates an emergency SOS.
2. The message is stored locally on the device.
3. A relay node buffers and forwards messages through a local mesh abstraction.
4. A gateway syncs pending messages to the backend when connectivity is available.
5. The FastAPI backend validates and aggregates data.
6. Command HQ presents active incidents, priorities, status transitions, and topology information.

The current browser MVP uses **IndexedDB** for offline persistence and **BroadcastChannel** as the local mesh transport abstraction. This implementation does not claim universal Bluetooth mesh, Wi‑Fi Direct mesh, or automatic emergency-service dispatch. Native transports such as Bluetooth Low Energy or Wi‑Fi Direct are future extensions.

## Key Features

### One-Tap Emergency SOS

- Mobile-first emergency interface
- SOS creation without requiring a long form
- Optional emergency details
- Local persistence of emergency messages
- Browser location attachment when available
- Minimal interaction during stressful situations

### Store-and-Forward Relay

- Local message buffering
- BroadcastChannel-based transport
- Duplicate message detection
- Hop counting
- Hop audit history
- Messages remain available when connectivity is unavailable

### Gateway Synchronization

- Inspection of pending emergency messages
- Synchronization with the backend through `POST /api/sync`
- Batch synchronization
- Failed synchronization does not silently delete local messages

### FastAPI Backend

- Message validation
- Global message deduplication
- Server timestamps
- Incident aggregation
- Status updates
- Mesh topology extraction
- JSON persistence for the current MVP

### Command HQ

- Active incident monitoring
- Zone-based incident aggregation
- Priority and people-affected information
- Processed / Dispatched / Resolved workflow
- Mesh topology visualization

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

The browser MVP models the mesh workflow through the `IMeshTransport` abstraction. The current implementation uses the browser `BroadcastChannel` API for local transport and IndexedDB for client-side persistence.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Vanilla CSS, Lucide Icons |
| Offline storage | IndexedDB, `idb` |
| Mesh transport | BroadcastChannel API, `IMeshTransport` abstraction |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Backend persistence | JSON persistence for the current MVP |
| Deployment | Frontend deployed on Vercel |

## Application Routes

- `#/send` — Citizen emergency SOS
- `#/node` — Relay node
- `#/gateway` — Gateway synchronization
- `#/command` — Incident Command HQ

When using the deployed application, routes can be opened by adding the hash route to the Vercel URL. For example:

```text
https://frontend-two-lime-h6f34t9yga.vercel.app/#/send
https://frontend-two-lime-h6f34t9yga.vercel.app/#/node
https://frontend-two-lime-h6f34t9yga.vercel.app/#/gateway
https://frontend-two-lime-h6f34t9yga.vercel.app/#/command
```

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Check backend availability |
| `POST` | `/api/sync` | Batch-sync pending emergency messages |
| `GET` | `/api/messages` | Retrieve all ingested messages |
| `GET` | `/api/incidents` | Retrieve aggregated incidents |
| `PATCH` | `/api/messages/{message_id}/status` | Update incident status |
| `GET` | `/api/topology` | Get mesh topology and message path information |
| `POST` | `/api/reset` | Reset backend data for demonstrations |

## Running Locally

The frontend is already deployed on Vercel. Use the local frontend setup only when you want to run and develop the frontend from the repository.

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

Local backend URLs:

- Backend: `http://127.0.0.1:8000`
- Health: `http://127.0.0.1:8000/health`
- API docs: `http://127.0.0.1:8000/docs`

### Frontend — Local Development Only

```bash
cd frontend
npm install
npm run dev
```

Local development URL:

- `http://localhost:5173/`

### Use the Deployed Frontend

For the live frontend, open:

```text
https://frontend-two-lime-h6f34t9yga.vercel.app
```

No local frontend installation is required to view the Vercel deployment.

## Demo Scenario

**Location:** Bridge Zone  
**Emergency:** RESCUE  
**People affected:** 3

**Situation:**

> 3 people trapped near the bridge. One child injured. Water level rising fast.

### Demo Flow

```text
SEND SOS
→ STORED LOCALLY
→ RELAY NODE
→ GATEWAY
→ SYNC TO HQ
→ COMMAND HQ
```

Suggested demonstration flow:

1. Open the [deployed Vercel frontend](https://frontend-two-lime-h6f34t9yga.vercel.app).
2. Go to `#/send` and create a rapid SOS.
3. Confirm that the message is stored locally.
4. Open `#/node` to show relay behavior and hop history.
5. Open `#/gateway` to synchronize pending messages with the backend.
6. Open `#/command` to review incident aggregation and status updates.

## Verification / Testing

The project has been verified for:

- TypeScript compilation
- Production frontend build
- Python compilation
- Offline SOS persistence
- Relay message handling
- Gateway synchronization
- Backend ingestion
- Message deduplication
- Incident aggregation
- Status updates
- Mesh topology generation
- Backend persistence
- Preservation of local messages when synchronization fails

## Current MVP Scope

The current implementation includes:

- IndexedDB offline persistence
- BroadcastChannel transport abstraction
- Local message buffering and deduplication
- Gateway synchronization to the backend
- Command center incident tracking and topology visualization
- A publicly deployed frontend on Vercel

The browser MVP does not provide universal Bluetooth or Wi‑Fi Direct mesh networking and does not automatically dispatch emergency services.

## Future Scope

Potential improvements for future versions include:

- Native Bluetooth Low Energy transport
- Wi‑Fi Direct or other local device-to-device communication
- Background synchronization and service-worker support
- More robust offline conflict handling
- Production-grade database backend
- Verified emergency-service integration
- Map-based incident tracking and geofencing
- Role-based access control for responders and operators

## Team

**HackShastra**

- Rudra Pratap Singh

## Hackathon

**Morrow 1.0 Round 2** by **Makers Need More (MnM)**

GitHub: [MakersNeedMore-MnM/Round2-HackShastra](https://github.com/MakersNeedMore-MnM/Round2-HackShastra)

## License

No explicit open-source license is currently declared in this repository. This project is presented as a hackathon submission for evaluation and demonstration.
