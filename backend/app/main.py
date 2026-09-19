import logging
import time
from typing import List, Optional, Union, Dict
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    EmergencyMessage,
    SyncBatchRequest,
    SyncBatchResponse,
    StatusUpdateRequest,
    ZoneIncident,
    TopologyNode,
    TopologyLink,
    TopologyResponse,
    HealthResponse,
)
from app.storage import store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("morrowmesh.api")

app = FastAPI(
    title="MorrowMesh Emergency Coordination API",
    description="Offline-first emergency mesh communication and coordination system backend.",
    version="0.2.0",
)

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="healthy",
        service="MorrowMesh Emergency Coordination API",
        version="0.2.0",
    )


@app.post("/api/sync", response_model=SyncBatchResponse)
def sync_messages(
    payload: Union[SyncBatchRequest, List[EmergencyMessage]] = Body(...)
):
    """Accept one or more EmergencyMessage packets from the Gateway.

    Validates, deduplicates by ID, preserves hop history, records arrival time.
    """
    messages_to_process: List[EmergencyMessage] = []
    if isinstance(payload, SyncBatchRequest):
        messages_to_process = payload.messages
    elif isinstance(payload, list):
        messages_to_process = payload

    accepted_ids: List[str] = []
    duplicate_ids: List[str] = []
    now_ms = int(time.time() * 1000)

    for incoming in messages_to_process:
        existing = store.get(incoming.id)
        if existing:
            duplicate_ids.append(incoming.id)
            continue

        # Ingest new message: preserve all metadata and record server arrival
        message_to_store = incoming.model_copy(
            update={
                "serverReceivedAt": now_ms,
                "status": "SYNCED_TO_GATEWAY" if incoming.status == "STORED_LOCALLY" or incoming.status == "RELAYED" else incoming.status,
            }
        )
        store.add_or_update(message_to_store)
        accepted_ids.append(incoming.id)

    logger.info(
        f"Sync completed: {len(accepted_ids)} accepted, {len(duplicate_ids)} duplicates."
    )

    return SyncBatchResponse(
        accepted=accepted_ids,
        duplicates=duplicate_ids,
        synced=len(accepted_ids),
    )


@app.get("/api/messages", response_model=List[EmergencyMessage])
def get_messages(
    priority: Optional[str] = Query(None, description="Filter by priority level"),
    type: Optional[str] = Query(None, description="Filter by emergency type"),
    location: Optional[str] = Query(None, description="Filter by location/zone"),
    status: Optional[str] = Query(None, description="Filter by message status"),
):
    """Return ingested emergency messages with optional filters."""
    messages = store.get_all()

    filtered = []
    for msg in messages:
        if priority and msg.priority.upper() != priority.upper():
            continue
        if type and msg.type.upper() != type.upper():
            continue
        if location and location.lower() not in msg.location.lower():
            continue
        if status and msg.status.upper() != status.upper():
            continue
        filtered.append(msg)

    # Return newest first
    return sorted(filtered, key=lambda m: m.timestamp, reverse=True)


@app.get("/api/incidents", response_model=List[ZoneIncident])
def get_incidents():
    """Aggregate messages by location/zone for the incident commander."""
    messages = store.get_all()
    zones_map: Dict[str, List[EmergencyMessage]] = {}

    for msg in messages:
        z = msg.location.strip() or "UNKNOWN ZONE"
        if z not in zones_map:
            zones_map[z] = []
        zones_map[z].append(msg)

    incidents: List[ZoneIncident] = []
    priority_order = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}

    for zone, zone_msgs in zones_map.items():
        total_reports = len(zone_msgs)
        total_people = sum(m.peopleAffected for m in zone_msgs)
        critical_count = sum(1 for m in zone_msgs if m.priority == "CRITICAL")
        latest_time = max(m.timestamp for m in zone_msgs)

        # Determine overall priority
        highest_prio_val = max(priority_order.get(m.priority, 1) for m in zone_msgs)
        overall_prio = "LOW"
        for p_name, p_val in priority_order.items():
            if p_val == highest_prio_val:
                overall_prio = p_name
                break

        unique_types = sorted(list(set(m.type for m in zone_msgs)))
        unique_statuses = sorted(list(set(m.status for m in zone_msgs)))

        incidents.append(
            ZoneIncident(
                zone=zone,
                reports=total_reports,
                peopleAffected=total_people,
                criticalReports=critical_count,
                latestTimestamp=latest_time,
                overallPriority=overall_prio,
                emergencyTypes=unique_types,
                activeStatuses=unique_statuses,
            )
        )

    # Sort incidents: CRITICAL first, then total people affected descending
    return sorted(
        incidents,
        key=lambda inc: (
            priority_order.get(inc.overallPriority, 1),
            inc.peopleAffected,
            inc.latestTimestamp,
        ),
        reverse=True,
    )


@app.patch("/api/messages/{message_id}/status", response_model=EmergencyMessage)
def update_message_status(message_id: str, payload: StatusUpdateRequest):
    """Allow Command HQ to update status: PROCESSED, DISPATCHED, RESOLVED."""
    valid_statuses = {"PROCESSED", "DISPATCHED", "RESOLVED"}
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Allowed values: {sorted(list(valid_statuses))}",
        )

    updated = store.update_status(message_id, payload.status)
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Emergency message with ID '{message_id}' not found.",
        )

    logger.info(f"Updated status of message {message_id} to {payload.status}")
    return updated


@app.get("/api/topology", response_model=TopologyResponse)
def get_topology():
    """Build a topology representation directly from message hop audit histories."""
    messages = store.get_all()
    nodes_map: Dict[str, TopologyNode] = {}
    links_map: Dict[str, int] = {}  # "source->target": count

    # Always ensure COMMAND-HQ exists as destination
    nodes_map["COMMAND-HQ"] = TopologyNode(
        id="COMMAND-HQ",
        type="HQ",
        label="COMMAND HQ",
    )

    for msg in messages:
        chain = []

        # 1. Start with origin node
        origin_id = msg.originNode
        if origin_id not in nodes_map:
            nodes_map[origin_id] = TopologyNode(
                id=origin_id,
                type="ORIGIN",
                label=f"ORIGIN ({origin_id})",
            )
        chain.append(origin_id)

        # 2. Add hops from audit history
        for hop in msg.history:
            hop_id = hop.node_id
            if hop_id not in nodes_map:
                node_type = "GATEWAY" if "GATEWAY" in hop_id.upper() else "RELAY"
                nodes_map[hop_id] = TopologyNode(
                    id=hop_id,
                    type=node_type,
                    label=f"{node_type} ({hop_id})",
                )
            if not chain or chain[-1] != hop_id:
                chain.append(hop_id)

        # 3. Add current node if not already at end of chain
        current_id = msg.currentNode
        if current_id and (not chain or chain[-1] != current_id):
            if current_id not in nodes_map:
                node_type = "GATEWAY" if "GATEWAY" in current_id.upper() else "RELAY"
                nodes_map[current_id] = TopologyNode(
                    id=current_id,
                    type=node_type,
                    label=f"{node_type} ({current_id})",
                )
            chain.append(current_id)

        # 4. Link last node in mesh to COMMAND-HQ
        last_node = chain[-1] if chain else origin_id
        # Mark last mesh node as GATEWAY if not already ORIGIN
        if last_node in nodes_map and nodes_map[last_node].type != "ORIGIN":
            nodes_map[last_node] = TopologyNode(
                id=last_node,
                type="GATEWAY",
                label=f"GATEWAY ({last_node})",
            )

        # Record pairwise links
        for i in range(len(chain) - 1):
            src, tgt = chain[i], chain[i + 1]
            if src != tgt:
                key = f"{src}->{tgt}"
                links_map[key] = links_map.get(key, 0) + 1

        # Final link to COMMAND-HQ
        hq_key = f"{last_node}->COMMAND-HQ"
        links_map[hq_key] = links_map.get(hq_key, 0) + 1

    # Format links
    links: List[TopologyLink] = []
    for key, count in links_map.items():
        src, tgt = key.split("->")
        links.append(TopologyLink(source=src, target=tgt, count=count))

    return TopologyResponse(nodes=list(nodes_map.values()), links=links)


@app.post("/api/reset")
def reset_backend_state():
    """Development/demo endpoint to clear all backend state."""
    store.clear()
    logger.info("Backend state cleared via /api/reset")
    return {"status": "reset", "message": "Backend state cleared."}
