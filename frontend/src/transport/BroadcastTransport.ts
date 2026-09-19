import type { EmergencyMessage } from '../types/message';
import type { IMeshTransport, TransportEvent, TransportListener, TransportType } from './MeshTransport';

interface BroadcastEnvelope {
  senderNodeId: string;
  targetNodeId?: string; // empty means broadcast to all
  payload: EmergencyMessage;
  envelopeTimestamp: number;
}

const MORROWMESH_CHANNEL_NAME = 'morrowmesh_p2p_channel';

/**
 * Reliable, zero-configuration local mesh transport using browser BroadcastChannel API.
 * Enables tabs and windows to communicate as separate peer nodes completely offline.
 */
export class BroadcastTransport implements IMeshTransport {
  public readonly transportType: TransportType = 'BROADCAST_CHANNEL';
  private channel: BroadcastChannel | null = null;
  private currentNodeId: string = '';
  private listeners: Set<TransportListener> = new Set();
  private connected: boolean = false;

  get isConnected(): boolean {
    return this.connected;
  }

  public async connect(nodeId: string): Promise<void> {
    this.currentNodeId = nodeId;

    if (typeof BroadcastChannel === 'undefined') {
      this.emit({
        type: 'ERROR',
        error: 'BroadcastChannel API is not supported in this browser.',
      });
      return;
    }

    if (!this.channel) {
      this.channel = new BroadcastChannel(MORROWMESH_CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<BroadcastEnvelope>) => {
        this.handleIncomingEnvelope(event.data);
      };
    }

    this.connected = true;

    // Announce presence
    try {
      this.channel.postMessage({
        senderNodeId: this.currentNodeId,
        type: 'HELLO',
        envelopeTimestamp: Date.now(),
      });
    } catch {
      // ignore init broadcast error
    }
  }

  public async disconnect(): Promise<void> {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.connected = false;
  }

  public async broadcast(message: EmergencyMessage): Promise<void> {
    if (!this.channel || !this.connected) {
      throw new Error('Transport not connected to mesh');
    }

    const envelope: BroadcastEnvelope = {
      senderNodeId: this.currentNodeId,
      payload: message,
      envelopeTimestamp: Date.now(),
    };

    this.channel.postMessage(envelope);
  }

  public subscribe(listener: TransportListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleIncomingEnvelope(data: any): void {
    if (!data || typeof data !== 'object') return;

    // Ignore packets originated by self
    if (data.senderNodeId === this.currentNodeId) {
      return;
    }

    // Handle peer announcements
    if (data.type === 'HELLO') {
      this.emit({
        type: 'PEER_CONNECTED',
        peerId: data.senderNodeId,
      });
      return;
    }

    // Handle emergency message payload
    if (data.payload && data.payload.id) {
      this.emit({
        type: 'MESSAGE_RECEIVED',
        message: data.payload as EmergencyMessage,
        senderNodeId: data.senderNodeId,
      });
    }
  }

  private emit(event: TransportEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in transport listener callback:', err);
      }
    }
  }
}
