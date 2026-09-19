import React, { useState, useEffect, useCallback } from 'react';
import { 
  Share2, 
  Clock, 
  MapPin, 
  Users, 
  RefreshCw
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

interface ActivityItem {
  timestamp: string;
  type: 'RECEIVED' | 'RELAYED' | 'STORED';
  text: string;
}

const MAX_HOPS = 8;

export const RelayNodePage: React.FC = () => {
  const [nodeId, setNodeId] = useState<string>('');
  const [messages, setMessages] = useState<EmergencyMessage[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [transport, setTransport] = useState<IMeshTransport | null>(null);
  const [relayedCount, setRelayedCount] = useState<number>(0);
  const [receivedCount, setReceivedCount] = useState<number>(0);
  const [relayingId, setRelayingId] = useState<string | null>(null);

  const addActivity = (type: ActivityItem['type'], text: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setActivities((prev) => [{ timestamp: timeStr, type, text }, ...prev.slice(0, 15)]);
  };

  const loadMessages = useCallback(async () => {
    const stored = await getOutboxMessages();
    setMessages(stored);
  }, []);

  useEffect(() => {
    const id = getOrCreateNodeId('morrowmesh_relay_node_id');
    setNodeId(id);
    loadMessages();

    const meshTransport = new BroadcastTransport();
    setTransport(meshTransport);

    meshTransport.connect(id).then(() => {
      addActivity('STORED', `Node initialized: ${id}`);
    });

    const unsubscribe = meshTransport.subscribe(async (event) => {
      if (event.type === 'MESSAGE_RECEIVED') {
        setReceivedCount((c) => c + 1);
        const incoming = event.message;

        // Duplicate suppression
        const seen = await messageExists(incoming.id);
        if (seen) return;

        if (incoming.originNode === id) return;
        if (incoming.hopCount >= MAX_HOPS) return;

        addActivity('RECEIVED', `SOS received from ${incoming.originNode}`);

        // Hop increment & audit record
        const hopEntry: HopAudit = {
          node_id: id,
          timestamp: Date.now(),
          action: 'relayed',
        };

        const updated: EmergencyMessage = {
          ...incoming,
          currentNode: id,
          hopCount: incoming.hopCount + 1,
          status: 'RELAYED',
          history: [...(incoming.history || []), hopEntry],
        };

        await saveMessage(updated);
        addActivity('STORED', `SOS stored in local outbox (Hop ${updated.hopCount})`);
        loadMessages();
      }
    });

    return () => {
      unsubscribe();
      meshTransport.disconnect();
    };
  }, [loadMessages]);

  const handleRelay = async (msg: EmergencyMessage) => {
    if (!transport) return;
    setRelayingId(msg.id);
    try {
      await transport.broadcast(msg);
      setRelayedCount((c) => c + 1);
      addActivity('RELAYED', `SOS relayed across local mesh peers`);
    } catch (err) {
      console.error('Relay error:', err);
    } finally {
      setTimeout(() => setRelayingId(null), 400);
    }
  };

  return (
    <div className="mobile-node-container">
      {/* Node Header */}
      <div className="node-header-bar">
        <div>
          <h1 className="node-page-title">RELAY NODE</h1>
          <span className="node-identity">NODE: {nodeId}</span>
        </div>
        <div className="node-status-pill">
          <span className="live-dot dot-green"></span>
          <span>NODE ACTIVE</span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="node-metrics-grid">
        <div className="node-metric-card">
          <span className="node-metric-val">{receivedCount}</span>
          <span className="node-metric-label">MESSAGES RECEIVED</span>
        </div>
        <div className="node-metric-card">
          <span className="node-metric-val">{relayedCount}</span>
          <span className="node-metric-label">MESSAGES RELAYED</span>
        </div>
        <div className="node-metric-card">
          <span className="node-metric-val">{messages.length}</span>
          <span className="node-metric-label">MESSAGES STORED</span>
        </div>
      </div>

      {/* Recent Messages to Relay */}
      <section className="node-card">
        <div className="card-header-simple">
          <h2 className="section-heading">STORED MESSAGES</h2>
          <button type="button" onClick={loadMessages} className="btn-compact">
            <RefreshCw size={12} />
            <span>REFRESH</span>
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="empty-state-simple">
            <p>No messages currently held in relay buffer.</p>
            <span className="text-dim">Nearby phones broadcasting SOS will appear here.</span>
          </div>
        ) : (
          <div className="node-messages-list">
            {messages.map((msg) => (
              <div key={msg.id} className="relay-packet-item">
                <div className="relay-packet-top">
                  <span className="packet-id">{msg.id}</span>
                  <span className={`priority-tag priority-${msg.priority.toLowerCase()}`}>
                    {msg.priority}
                  </span>
                </div>

                <p className="packet-body">{msg.message}</p>

                <div className="packet-meta">
                  <span className="meta-item"><Clock size={12} />{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  <span className="meta-item"><MapPin size={12} />{msg.location}</span>
                  <span className="meta-item"><Users size={12} />{msg.peopleAffected}</span>
                </div>

                <div className="relay-packet-action">
                  <span className="hop-pill">HOPS: {msg.hopCount}</span>
                  <button
                    type="button"
                    disabled={relayingId === msg.id}
                    onClick={() => handleRelay(msg)}
                    className="btn-relay-action"
                  >
                    <Share2 size={13} />
                    <span>{relayingId === msg.id ? 'RELAYING...' : 'RELAY MESSAGE'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity Feed */}
      <section className="node-card">
        <h2 className="section-heading">RECENT ACTIVITY</h2>
        <div className="activity-feed">
          {activities.length === 0 ? (
            <div className="empty-state-simple">
              <span>Awaiting mesh activity...</span>
            </div>
          ) : (
            activities.map((act, idx) => (
              <div key={idx} className="activity-line">
                <span className="act-time">{act.timestamp}</span>
                <span className={`act-badge act-${act.type.toLowerCase()}`}>{act.type}</span>
                <span className="act-text">{act.text}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
