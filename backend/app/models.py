from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class HopAudit(BaseModel):
    node_id: str
    timestamp: int
    action: str = "relayed"  # created, relayed, received_at_gateway


class EmergencyMessage(BaseModel):
    id: str = Field(..., description="Globally unique message ID (UUID + originNode)")
    timestamp: int = Field(..., description="Epoch timestamp in milliseconds")
    message: str = Field(..., description="Raw emergency report text")
    type: Literal["RESCUE", "MEDICAL", "HAZARD", "SUPPLIES", "SHELTER", "OTHER"] = "RESCUE"
    peopleAffected: int = Field(default=1, description="Number of people reported affected")
    location: str = Field(default="UNKNOWN", description="Reported landmark/zone")
    priority: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"] = "HIGH"
    originNode: str = Field(..., description="Identifier of the originating node")
    currentNode: str = Field(..., description="Current node handling or relaying the message")
    hopCount: int = Field(default=0, description="Total mesh hops traversed")
    status: Literal[
        "STORED_LOCALLY",
        "RELAYED",
        "SYNCED_TO_GATEWAY",
        "PROCESSED",
        "DISPATCHED",
        "RESOLVED",
    ] = "STORED_LOCALLY"
    history: List[HopAudit] = Field(default_factory=list, description="Audit chain of nodes traversed")
    serverReceivedAt: Optional[int] = Field(default=None, description="Server ingestion timestamp (ms)")


class SyncBatchRequest(BaseModel):
    messages: List[EmergencyMessage] = Field(default_factory=list)


class SyncBatchResponse(BaseModel):
    accepted: List[str]
    duplicates: List[str]
    synced: int


class StatusUpdateRequest(BaseModel):
    status: Literal["PROCESSED", "DISPATCHED", "RESOLVED"]


class ZoneIncident(BaseModel):
    zone: str
    reports: int
    peopleAffected: int
    criticalReports: int
    latestTimestamp: int
    overallPriority: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    emergencyTypes: List[str]
    activeStatuses: List[str]


class TopologyNode(BaseModel):
    id: str
    type: Literal["ORIGIN", "RELAY", "GATEWAY", "HQ"]
    label: str


class TopologyLink(BaseModel):
    source: str
    target: str
    count: int = 1


class TopologyResponse(BaseModel):
    nodes: List[TopologyNode]
    links: List[TopologyLink]


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "MorrowMesh Emergency Coordination API"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = "0.1.0"
