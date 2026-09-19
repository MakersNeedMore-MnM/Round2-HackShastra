import type { EmergencyMessage } from '../types/message';

export type TransportType = 'BROADCAST_CHANNEL' | 'WEBRTC' | 'NATIVE_BLE_STUB';

export type TransportEvent = 
  | { type: 'PEER_CONNECTED'; peerId: string }
  | { type: 'PEER_DISCONNECTED'; peerId: string }
  | { type: 'MESSAGE_RECEIVED'; message: EmergencyMessage; senderNodeId: string }
  | { type: 'ERROR'; error: string };

export type TransportListener = (event: TransportEvent) => void;

/**
 * Clean transport abstraction for MorrowMesh.
 * The application layer relies solely on this interface so future transports
 * (e.g. WebRTC DataChannels, Native Bluetooth LE, Wi-Fi Direct) can be plugged in
 * without rewriting storage or routing logic.
 */
export interface IMeshTransport {
  readonly transportType: TransportType;
  readonly isConnected: boolean;

  /**
   * Connect to the local mesh environment.
   */
  connect(nodeId: string): Promise<void>;

  /**
   * Disconnect from the mesh.
   */
  disconnect(): Promise<void>;

  /**
   * Broadcast an emergency message to all available peers.
   */
  broadcast(message: EmergencyMessage): Promise<void>;

  /**
   * Subscribe to transport events (incoming packets, peer state changes).
   */
  subscribe(listener: TransportListener): () => void;
}
