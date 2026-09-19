import type {
  EmergencyMessage,
  SyncBatchResponse,
  ZoneIncident,
  TopologyResponse,
} from '../types/message';

const API_BASE_URL = 'http://127.0.0.1:8000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const api = {
  /**
   * Ping the FastAPI backend health check.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Batch synchronize messages from Gateway to backend.
   */
  async syncMessages(messages: EmergencyMessage[]): Promise<SyncBatchResponse> {
    const response = await fetch(`${API_BASE_URL}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(`Sync failed (${response.status}): ${errorText}`, response.status);
    }

    return response.json();
  },

  /**
   * Retrieve ingested emergency messages with optional filters.
   */
  async getMessages(filters?: {
    priority?: string;
    type?: string;
    location?: string;
    status?: string;
  }): Promise<EmergencyMessage[]> {
    const params = new URLSearchParams();
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.location) params.set('location', filters.location);
    if (filters?.status) params.set('status', filters.status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/messages${qs}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new ApiError(`Failed to fetch messages (${response.status})`, response.status);
    }

    return response.json();
  },

  /**
   * Get zone-aggregated incidents for Command HQ.
   */
  async getIncidents(): Promise<ZoneIncident[]> {
    const response = await fetch(`${API_BASE_URL}/api/incidents`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new ApiError(`Failed to fetch incidents (${response.status})`, response.status);
    }

    return response.json();
  },

  /**
   * Update emergency message status (PROCESSED, DISPATCHED, RESOLVED).
   */
  async updateMessageStatus(
    messageId: string,
    status: 'PROCESSED' | 'DISPATCHED' | 'RESOLVED'
  ): Promise<EmergencyMessage> {
    const response = await fetch(`${API_BASE_URL}/api/messages/${encodeURIComponent(messageId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const errDetail = await response.text();
      throw new ApiError(`Failed to update status (${response.status}): ${errDetail}`, response.status);
    }

    return response.json();
  },

  /**
   * Retrieve dynamic mesh topology derived from hop audit chains.
   */
  async getTopology(): Promise<TopologyResponse> {
    const response = await fetch(`${API_BASE_URL}/api/topology`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new ApiError(`Failed to fetch topology (${response.status})`, response.status);
    }

    return response.json();
  },

  /**
   * Reset backend state (for demos / testing).
   */
  async resetBackend(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/reset`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new ApiError(`Reset failed (${response.status})`, response.status);
    }
  },
};
