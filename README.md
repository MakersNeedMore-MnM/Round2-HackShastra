# MorrowMesh — Emergency Mesh & Disaster Coordination

> *"When the network fails, the people become the network."*  
> **Team HackShastra // Round 2 Submission**

---

## 📡 The Problem
During catastrophic natural disasters (floods, hurricanes, earthquakes) or critical infrastructure collapses, centralized cellular towers and broadband networks are the very first systems to go dark. When communication fails, victims are stranded, and rescue teams operate blind.

## ⚡ The Solution: MorrowMesh
MorrowMesh is an offline-first emergency mesh communication and disaster coordination platform. It creates an ad-hoc, delay-tolerant store-and-forward mesh network directly in browser hardware. Field packets hop securely from citizen to citizen until any single node connects to an internet gateway, uplinking all field intelligence to Incident Command HQ.

---

## 🔄 The Real Pipeline Flow

```
[ CITIZEN IN DISTRESS ]
       │
       ▼
 1. ORIGIN NODE (/send)
    • Offline report creation (Location, Casualties, Priority)
    • Guaranteed hardware persistence (IndexedDB Outbox)
       │
       ▼ P2P Broadcast Transport
 2. RELAY COURIER NODE (/node)
    • Store-and-forward buffer
    • Duplicate suppression filter (seen_messages)
    • TTL & Hop-chain management (HopAudit)
       │
       ▼ Physical movement / Local Mesh
 3. GATEWAY NODE (/gateway)
    • Discovers local emergency packets
    • Monitors upstream internet/satellite connectivity
    • Reliable batch uplink (`POST /api/sync`)
       │
       ▼ HTTP / REST
 4. FASTAPI COORDINATION BACKEND
    • Ingestion, schema validation, and server timestamping
    • Global ID deduplication
    • Dynamic topology extraction from audit chains
       │
       ▼ REST / Real-time polling
 5. CENTRAL INCIDENT COMMAND HQ (/command)
    • Live disaster zone aggregation summary
    • Active priority triage queue (CRITICAL, HIGH, MEDIUM, LOW)
    • Operator dispatch actions (PROCESSED, DISPATCHED, RESOLVED)
    • Derived mesh hop topology graph
```

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React 19, TypeScript, Vite, Vanilla CSS Design System (Tactical Emergency Operations Dark Graphite theme), Lucide Icons.
- **Offline Storage:** Browser IndexedDB via `idb` (`outbox`, `seen_messages`, `synced_messages`).
- **Mesh Transport:** Zero-config P2P `BroadcastChannel` abstraction (`IMeshTransport`).
- **Backend:** FastAPI, Pydantic v2, Uvicorn, in-memory cache with atomic JSON file persistence.

---

## 🚀 Running Locally

### 1. Backend (FastAPI)
```powershell
cd backend
# Install dependencies
pip install -r requirements.txt

# Start API server on port 8000
python -m uvicorn app.main:app --port 8000
```
- API Base: `http://127.0.0.1:8000`
- Health Check: `http://127.0.0.1:8000/health`
- Interactive Docs: `http://127.0.0.1:8000/docs`

### 2. Frontend (React + Vite)
```powershell
cd frontend
# Install dependencies
npm install

# Start development server
npm run dev
```
- App URL: `http://localhost:5173/`

---

## 📍 Key Routes

- `#/send`: **Origin SOS Node** — Create emergency reports completely offline.
- `#/node`: **Relay Courier Node** — Delay-tolerant routing buffer with deduplication and live audit log.
- `#/gateway`: **Gateway Uplink Node** — Offline buffer inspection and batch sync to Central Command.
- `#/command`: **Incident Command HQ** — Tactical triage matrix, zone casualty summaries, status dispatchers, and hop topology visualizer.

---

## 🧪 Verification & Testing

- **TypeScript Typecheck:** `npm run build` (`tsc -b && vite build`) — 0 errors.
- **Python Compilation:** `python -m py_compile app/main.py app/models.py app/storage.py` — 0 errors.
- **Offline Resilience:** If the backend is unreachable during sync, packets are never dropped and remain safely queued in IndexedDB until connectivity is restored.
- **Deduplication:** Multiple syncs of the same packet are recognized and handled idempotently without corrupting message state.
