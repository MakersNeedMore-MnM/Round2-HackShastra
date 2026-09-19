import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Share2, 
  Clock, 
  MapPin, 
  Users, 
  ArrowRight, 
  Layers, 
  RefreshCw,
  Terminal,
  Activity
} from 'lucide-react';
import type { EmergencyMessage, HopAudit } from '../types/message';
import { 
  getOutboxMessages, 
  saveMessage, 
  messageExists, 
  getOrCreateNodeId 
} from '../storage/db';
import { BroadcastTransport } from '../transport/BroadcastTransport';
import type { IMeshTransport } from '../transport/MeshTransport';

interface RelayEvent {
  timestamp: string;
  type: 'INFO' | 'RECEIVE' | 'FORWARD' | 'DUPLICATE' | 'TTL_EXPIRED';
  message: string;
}

interface RelayNodePageProps {
  forcedNodeId?: string;
  dbName?: string;
}

const MAX_HOPS = 8;

export const RelayNodePage: React.FC<RelayNodePageProps> = ({ forcedNodeId, dbName }) => {
  const [nodeId, setNodeId] = useState<string>('');
  const [transportStatus, setTransportStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'READY'>('CONNECTING');
  const [messages, setMessages] = useState<EmergencyMessage[]>([]);
  const [events, setEvents] = useState<RelayEvent[]>([]);
  const [transport, setTransport] = useState<IMeshTransport | null>(null);
  const [forwardingId, setForwardingId] = useState<string | null>(null);

  const addEvent = (type: RelayEvent['type'], msg: string) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setEvents((prev) => [{ timestamp: timeStr, type, message: msg }, ...prev.slice(0, 40)]);
  };

  // 1. Initialize Node Identity & Transport
  useEffect(() => {
    // If forcedNodeId is provided (e.g. for multi-node in-app tabs), use it;
    // otherwise use session-persistent node ID for this window/tab
    const id = forcedNodeId || getOrCreateNodeId(dbName ? `morrowmesh_node_${dbName}` : 'morrowmesh_relay_node_id');
    setNodeId(id);

    const activeDbName = dbName || (id ? `db_${id}` : undefined);

    // Initial load of messages from local IndexedDB
    getOutboxMessages(activeDbName).then((stored) => {
      setMessages(stored);
      addEvent('INFO', `Node initialized with ID: ${id}`);
    });

    const meshTransport = new BroadcastTransport();
    setTransport(meshTransport);

    meshTransport.connect(id).then(() => {
      setTransportStatus('READY');
      addEvent('INFO', 'BroadcastChannel transport connected: MORROWMESH_P2P');
    });

    // Subscribe to incoming mesh envelopes
    const unsubscribe = meshTransport.subscribe(async (event) => {
      if (event.type === 'PEER_CONNECTED') {
        addEvent('INFO', `Peer announcement received from: ${event.peerId}`);
      } else if (event.type === 'MESSAGE_RECEIVED') {
        await handleIncomingMessage(event.message, event.senderNodeId, id, activeDbName, meshTransport);
      } else if (event.type === 'ERROR') {
        addEvent('INFO', `Transport error: ${event.error}`);
      }
    });

    return () => {
      unsubscribe();
      meshTransport.disconnect();
    };
  }, [forcedNodeId, dbName]);

  // 2. Handle Incoming Message with Duplicate Suppression & Hop Management
  const handleIncomingMessage = async (
    incoming: EmergencyMessage,
    senderNodeId: string,
    currentNodeId: string,
    activeDbName: string | undefined,
    _transportInstance: IMeshTransport
  ) => {
    addEvent('RECEIVE', `Incoming packet ${incoming.id} from sender ${senderNodeId}`);

    // Check if we are the origin node (avoid self-reflection)
    if (incoming.originNode === currentNodeId) {
      addEvent('DUPLICATE', `Packet ${incoming.id} originated locally. Dropping echo.`);
      return;
    }

    // Step 2 & 3: Check IndexedDB seen_messages for duplicate suppression
    const alreadySeen = await messageExists(incoming.id, activeDbName);
    if (alreadySeen) {
      addEvent('DUPLICATE', `DUPLICATE IGNORED: ${incoming.id} already recorded in seen_messages`);
      return;
    }

    // Step 7: Check TTL / Hop Limit
    if (incoming.hopCount >= MAX_HOPS) {
      addEvent('TTL_EXPIRED', `TTL EXPIRED: Packet ${incoming.id} exceeded MAX_HOPS (${MAX_HOPS})`);
      return;
    }

    // Step 4: Increment hop count, record currentNode, append HopAudit entry
    const newHopCount = incoming.hopCount + 1;
    const now = Date.now();
    const hopEntry: HopAudit = {
      node_id: currentNodeId,
      timestamp: now,
      action: 'relayed',
    };

    const updatedMessage: EmergencyMessage = {
      ...incoming,
      currentNode: currentNodeId,
      hopCount: newHopCount,
      status: 'RELAYED',
      history: [...(incoming.history || []), hopEntry],
    };

    // Step 5: Persist updated message to this node's IndexedDB
    await saveMessage(updatedMessage, activeDbName);

    // Refresh list from IndexedDB to verify persistence
    const refreshed = await getOutboxMessages(activeDbName);
    setMessages(refreshed);

    addEvent('RECEIVE', `STORED LOCALLY: ${incoming.id} | Hop ${newHopCount} (Origin: ${incoming.originNode})`);
    addEvent('INFO', `READY FOR FORWARD: Stored in relay queue`);
  };

  // 3. Forward message onwards to any nearby nodes
  const handleForward = async (msg: EmergencyMessage) => {
    if (!transport) return;
    setForwardingId(msg.id);

    try {
      addEvent('FORWARD', `Broadcasting packet ${msg.id} to mesh peers...`);
      await transport.broadcast(msg);
      addEvent('FORWARD', `✓ Packet ${msg.id} forwarded across BroadcastChannel.`);
    } catch (err) {
      addEvent('INFO', `Forwarding error: ${(err as Error).message}`);
    } finally {
      setTimeout(() => setForwardingId(null), 500);
    }
  };

  const handleRefresh = async () => {
    const activeDbName = dbName || (nodeId ? `db_${nodeId}` : undefined);
    const stored = await getOutboxMessages(activeDbName);
    setMessages(stored);
    addEvent('INFO', `Refreshed local queue (${stored.length} messages)`);
  };

  return (
    <div className="relay-page-container">
      {/* Node Status Bar */}
      <div className="relay-status-header">
        <div className="relay-meta-group">
          <div className="relay-badge">
            <Radio size={14} className="icon-pulse" />
            <span>NODE ID: <strong>{nodeId || 'INITIALIZING...'}</strong></span>
          </div>
          <div className="relay-badge badge-transport">
            <Activity size={14} />
            <span>TRANSPORT: <strong>BROADCAST CHANNEL (P2P)</strong></span>
          </div>
          <div className={`relay-badge ${transportStatus === 'READY' ? 'badge-ok' : 'badge-warn'}`}>
            <span className="live-dot"></span>
            <span>CONNECTION: <strong>{transportStatus}</strong></span>
          </div>
        </div>

        <button 
          onClick={handleRefresh}
          className="btn-compact"
          title="Reload messages from IndexedDB"
        >
          <RefreshCw size={12} />
          <span>REFRESH STORE</span>
        </button>
      </div>

      <div className="content-grid">
        {/* Left Column: Incoming / Stored Relay Queue */}
        <section className="terminal-card" aria-labelledby="relay-queue-title">
          <div className="card-header">
            <div className="header-title-group">
              <Layers size={18} className="icon-cyan" />
              <h2 id="relay-queue-title" className="card-title">STORE-AND-FORWARD RELAY BUFFER</h2>
            </div>
            <span className="count-badge" id="relay-count-badge">
              {messages.length} {messages.length === 1 ? 'PACKET' : 'PACKETS'}
            </span>
          </div>

          <p className="card-subtitle">
            Delay-tolerant routing buffer. Packets are persisted to local IndexedDB storage, hop information is updated, and packets are held for downstream forwarding.
          </p>

          <div className="messages-list">
            {messages.length === 0 ? (
              <div className="empty-state">
                <Radio size={32} className="empty-icon" />
                <p>Relay buffer empty. Listening on P2P BroadcastChannel...</p>
                <span className="empty-hint">Broadcast an SOS from another node/tab to see the packet arrive here.</span>
              </div>
            ) : (
              messages.map((msg) => (
                <article key={msg.id} className="message-packet-card" data-id={msg.id}>
                  <div className="packet-header">
                    <span className="packet-id">{msg.id}</span>
                    <span className={`priority-tag priority-${msg.priority.toLowerCase()}`}>
                      {msg.priority}
                    </span>
                  </div>

                  <div className="packet-meta">
                    <span className="meta-item">
                      <Clock size={12} />
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="meta-item">
                      <MapPin size={12} />
                      {msg.location}
                    </span>
                    <span className="meta-item">
                      <Users size={12} />
                      {msg.peopleAffected} {msg.peopleAffected === 1 ? 'person' : 'people'}
                    </span>
                  </div>

                  <p className="packet-body">{msg.message}</p>

                  {/* Visual Hop Chain */}
                  <div className="routing-chain-box">
                    <div className="chain-row">
                      <span className="chain-node origin-tag">ORIGIN: {msg.originNode}</span>
                      <ArrowRight size={12} className="chain-arrow" />
                      {msg.history && msg.history.length > 1 && (
                        <>
                          <span className="chain-node">
                            {msg.history.slice(0, -1).map(h => h.node_id).join(' → ')}
                          </span>
                          <ArrowRight size={12} className="chain-arrow" />
                        </>
                      )}
                      <span className="chain-node current-tag">CURRENT: {msg.currentNode}</span>
                    </div>
                    <div className="chain-stats">
                      <span>HOP COUNT: <strong>{msg.hopCount}</strong></span>
                      <span className="separator">|</span>
                      <span>STATUS: <strong>{msg.status}</strong></span>
                    </div>
                  </div>

                  <div className="packet-footer">
                    <span className="status-pill pill-online">
                      ✓ STORED &amp; READY
                    </span>

                    <button
                      type="button"
                      disabled={forwardingId === msg.id}
                      onClick={() => handleForward(msg)}
                      className="btn-forward-action"
                      id={`forward-btn-${msg.id}`}
                    >
                      <Share2 size={13} />
                      <span>{forwardingId === msg.id ? 'FORWARDING...' : 'FORWARD PACKET'}</span>
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* Right Column: Tactical Event Log */}
        <section className="terminal-card log-section" aria-labelledby="event-log-title">
          <div className="card-header">
            <div className="header-title-group">
              <Terminal size={18} className="icon-cyan" />
              <h2 id="event-log-title" className="card-title">RELAY EVENT LOG &amp; AUDIT TRAIL</h2>
            </div>
            <span className="sim-badge">LIVE MONITOR</span>
          </div>

          <p className="card-subtitle">
            Real-time audit log of peer discoveries, packet ingestions, hop increments, and duplicate suppression filters.
          </p>

          <div className="event-log-terminal" id="relay-event-log">
            {events.length === 0 ? (
              <div className="log-line text-muted">Awaiting mesh events...</div>
            ) : (
              events.map((evt, idx) => (
                <div key={idx} className={`log-line log-${evt.type.toLowerCase()}`}>
                  <span className="log-time">[{evt.timestamp}]</span>
                  <span className={`log-tag tag-${evt.type.toLowerCase()}`}>
                    {evt.type}
                  </span>
                  <span className="log-text">{evt.message}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
