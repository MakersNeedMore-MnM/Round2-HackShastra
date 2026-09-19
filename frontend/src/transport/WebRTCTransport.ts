import type { EmergencyMessage } from '../types/message';
import type { IMeshTransport, TransportListener, TransportType } from './MeshTransport';

/**
 * WebRTCTransport Stub / Future Adapter.
 * Conforms to IMeshTransport so when WebRTC signaling / DataChannels are active,
 * it can be selected seamlessly without modifying any upper application code.
 */
export class WebRTCTransport implements IMeshTransport {
  public readonly transportType: TransportType = 'WEBRTC';
  private listeners: Set<TransportListener> = new Set();
  private connected: boolean = false;

  get isConnected(): boolean {
    return this.connected;
  }

  public async connect(_nodeId: string): Promise<void> {
    // Stub implementation: ready for future signaling server / direct ICE negotiation
    this.connected = false;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  public async broadcast(_message: EmergencyMessage): Promise<void> {
    throw new Error('WebRTC transport signaling not configured for this node. Using BroadcastChannel fallback.');
  }

  public subscribe(listener: TransportListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
