export type EmergencyType = 
  | 'RESCUE'
  | 'MEDICAL'
  | 'HAZARD'
  | 'SUPPLIES'
  | 'SHELTER'
  | 'OTHER';

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type MessageStatus = 
  | 'STORED_LOCALLY'
  | 'RELAYED'
  | 'SYNCED_TO_GATEWAY'
  | 'PROCESSED'
  | 'DISPATCHED'
  | 'RESOLVED';

export interface HopAudit {
  node_id: string;
  timestamp: number;
  action: 'created' | 'relayed' | 'received_at_gateway';
}

export interface EmergencyMessage {
  id: string;
  timestamp: number;
  message: string;
  type: EmergencyType;
  peopleAffected: number;
  location: string;
  priority: PriorityLevel;
  originNode: string;
  currentNode: string;
  hopCount: number;
  status: MessageStatus;
  history: HopAudit[];
  serverReceivedAt?: number;
}

export interface SyncBatchResponse {
  accepted: string[];
  duplicates: string[];
  synced: number;
}

export interface ZoneIncident {
  zone: string;
  reports: number;
  peopleAffected: number;
  criticalReports: number;
  latestTimestamp: number;
  overallPriority: PriorityLevel;
  emergencyTypes: string[];
  activeStatuses: string[];
}

export interface TopologyNode {
  id: string;
  type: 'ORIGIN' | 'RELAY' | 'GATEWAY' | 'HQ';
  label: string;
}

export interface TopologyLink {
  source: string;
  target: string;
  count: number;
}

export interface TopologyResponse {
  nodes: TopologyNode[];
  links: TopologyLink[];
}
