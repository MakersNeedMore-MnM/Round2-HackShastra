import React, { useState, useEffect, useCallback } from 'react';
import { 
  CloudUpload, 
  Database, 
  Server, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Radio, 
  Layers, 
  MapPin, 
  Users, 
  ShieldAlert
} from 'lucide-react';
import type { EmergencyMessage } from '../types/message';
import { 
  getOutboxMessages, 
  markMessageAsSynced, 
  getOrCreateNodeId, 
  saveMessage, 
  messageExists 
} from '../storage/db';
import { BroadcastTransport } from '../transport/BroadcastTransport';
import { api } from '../services/api';

interface GatewayPageProps {
  onNavigateToHq?: () => void;
}

export const GatewayPage: React.FC<GatewayPageProps> = ({ onNavigateToHq }) => {
  const [nodeId, setNodeId] = useState<string>('');
  const [messages, setMessages] = useState<EmergencyMessage[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'READY' | 'SYNCING' | 'COMPLETE' | 'FAILED'>('READY');
  const [lastSyncTime, setLastSyncTime] = useState<string>('NEVER');
  const [statusFeedback, setStatusFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [syncedCount, setSyncedCount] = useState<number>(0);

  // 1. Refresh mesh messages from IndexedDB
  const refreshLocalMessages = useCallback(async () => {
    try {
      const all = await getOutboxMessages();
      setMessages(all);
    } catch (err) {
      console.error('Error loading outbox from IndexedDB:', err);
    }
  }, []);

  // 2. Poll Backend Health
  const checkBackendHealth = useCallback(async () => {
    const isHealthy = await api.checkHealth();
    setBackendOnline(isHealthy);
    return isHealthy;
  }, []);

  // 3. Initialize Gateway Node & BroadcastChannel listener
  useEffect(() => {
    const id = getOrCreateNodeId('morrowmesh_gateway_node_id');
    setNodeId(id);

    refreshLocalMessages();
    checkBackendHealth();

    // Health ping loop every 5s
    const healthInterval = setInterval(checkBackendHealth, 5000);

    // Listen on BroadcastTransport for incoming relayed packets arriving at this gateway
    const meshTransport = new BroadcastTransport();
    meshTransport.connect(id).then(() => {
      meshTransport.subscribe(async (event) => {
        if (event.type === 'MESSAGE_RECEIVED') {
          const incoming = event.message;
          const seen = await messageExists(incoming.id);
          if (!seen) {
            // Record hop audit for gateway arrival
            const hopAudit = {
              node_id: id,
              timestamp: Date.now(),
              action: 'received_at_gateway' as const,
            };
            const updated: EmergencyMessage = {
              ...incoming,
              currentNode: id,
              hopCount: incoming.hopCount + 1,
              status: 'STORED_LOCALLY',
              history: [...(incoming.history || []), hopAudit],
            };
            await saveMessage(updated);
            refreshLocalMessages();
          }
        }
      });
    });

    return () => {
      clearInterval(healthInterval);
      meshTransport.disconnect();
    };
  }, [checkBackendHealth, refreshLocalMessages]);

  const pendingMessages = messages.filter(
    (m) =>
      m.status !== 'SYNCED_TO_GATEWAY' &&
      m.status !== 'PROCESSED' &&
      m.status !== 'DISPATCHED' &&
      m.status !== 'RESOLVED'
  );

  // 4. Synchronization Action: POST /api/sync
  const handleSyncToHq = async () => {
    if (pendingMessages.length === 0) {
      setStatusFeedback({
        text: 'Mesh buffer has no pending messages to synchronize.',
        type: 'info',
      });
      return;
    }

    setSyncStatus('SYNCING');
    setStatusFeedback({
      text: `Connecting to Central Command HQ and uplinking ${pendingMessages.length} packet(s)...`,
      type: 'info',
    });

    try {
      // 1. Verify backend is accessible
      const isOnline = await checkBackendHealth();
      if (!isOnline) {
        throw new Error('Backend is unreachable. Messages preserved locally in IndexedDB.');
      }

      // 2. Transmit to backend
      const result = await api.syncMessages(pendingMessages);

      // 3. Mark successfully accepted or duplicate messages as synced in IndexedDB
      const allProcessedIds = [...result.accepted, ...result.duplicates];
      for (const msgId of allProcessedIds) {
        await markMessageAsSynced(msgId);
      }

      // 4. Update UI state
      const nowFormatted = new Date().toLocaleTimeString();
      setLastSyncTime(nowFormatted);
      setSyncStatus('COMPLETE');
      setSyncedCount((prev) => prev + result.synced);

      setStatusFeedback({
        text: `✓ SYNC COMPLETE: ${result.synced} message(s) newly ingested, ${result.duplicates.length} duplicates recognized.`,
        type: 'success',
      });

      // 5. Refresh local store to reflect updated statuses
      await refreshLocalMessages();
    } catch (err) {
      console.error('Gateway sync failed:', err);
      setSyncStatus('FAILED');
      setStatusFeedback({
        text: `SYNC FAILED: ${(err as Error).message}. All packets safely retained in IndexedDB.`,
        type: 'error',
      });
    }
  };

  return (
    <div className="gateway-page-container">
      {/* Top Status Bar */}
      <div className="gateway-status-bar">
        <div className="status-metric-group">
          <div className="metric-badge">
            <Radio size={14} className="icon-pulse" />
            <span>GATEWAY NODE: <strong>{nodeId || 'INITIALIZING...'}</strong></span>
          </div>

          <div className={`metric-badge ${backendOnline ? 'badge-ok' : 'badge-danger'}`}>
            <Server size={14} />
            <span>BACKEND: <strong>{backendOnline ? 'ONLINE' : 'OFFLINE'}</strong></span>
          </div>

          <div className="metric-badge">
            <Database size={14} />
            <span>MESH BUFFER: <strong>{pendingMessages.length} PENDING</strong> / {messages.length} TOTAL</span>
          </div>

          <div className="metric-badge">
            <Clock size={14} />
            <span>LAST SYNC: <strong>{lastSyncTime}</strong></span>
          </div>

          <div className={`metric-badge badge-sync-${syncStatus.toLowerCase()}`}>
            <span>SYNC STATUS: <strong>{syncStatus}</strong></span>
          </div>
        </div>

        <div className="gateway-header-actions">
          <button
            type="button"
            onClick={refreshLocalMessages}
            className="btn-compact"
            title="Refresh local IndexedDB queue"
          >
            <RefreshCw size={12} />
            <span>REFRESH STORE</span>
          </button>
        </div>
      </div>

      {/* Main Gateway Control Card */}
      <div className="content-grid">
        <section className="terminal-card" aria-labelledby="gateway-uplink-title">
          <div className="card-header">
            <div className="header-title-group">
              <CloudUpload size={20} className="icon-cyan" />
              <h2 id="gateway-uplink-title" className="card-title">GATEWAY STORE-AND-FORWARD UPLINK</h2>
            </div>
            <span className="sim-badge">INTERNET BRIDGE</span>
          </div>

          <p className="card-subtitle">
            The Gateway node bridges disconnected disaster mesh nodes to Central Incident Command. Incoming packets from physical couriers or peer relays are safely buffered in local IndexedDB until upstream connectivity is verified.
          </p>

          <div className="gateway-action-panel">
            <div className="sync-stats-box">
              <div className="sync-stat">
                <span className="stat-num">{pendingMessages.length}</span>
                <span className="stat-label">PENDING UPLINK</span>
              </div>
              <div className="sync-stat">
                <span className="stat-num">{syncedCount}</span>
                <span className="stat-label">INGESTED THIS SESSION</span>
              </div>
              <div className="sync-stat">
                <span className="stat-num">{backendOnline ? 'CONNECTED' : 'DISCONNECTED'}</span>
                <span className="stat-label">HQ UPLINK STATUS</span>
              </div>
            </div>

            {statusFeedback && (
              <div 
                className={`status-alert ${statusFeedback.type === 'success' ? 'alert-success' : statusFeedback.type === 'error' ? 'alert-danger' : 'alert-info'}`}
                role="alert"
              >
                {statusFeedback.type === 'success' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                <span>{statusFeedback.text}</span>
              </div>
            )}

            <div className="action-buttons-row">
              <button
                type="button"
                id="sync-to-hq-btn"
                onClick={handleSyncToHq}
                disabled={syncStatus === 'SYNCING'}
                className="btn-emergency-action"
              >
                <CloudUpload size={18} />
                <span>
                  {syncStatus === 'SYNCING'
                    ? 'UPLINKING TO HQ...'
                    : `SYNC TO HQ (${pendingMessages.length} PACKETS)`}
                </span>
              </button>

              {onNavigateToHq && (
                <button
                  type="button"
                  id="open-hq-btn"
                  onClick={onNavigateToHq}
                  className="btn-secondary-action"
                >
                  <ShieldAlert size={16} />
                  <span>OPEN COMMAND HQ →</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Local Mesh Buffer Packet Inspector */}
        <section className="terminal-card" aria-labelledby="buffer-inspector-title">
          <div className="card-header">
            <div className="header-title-group">
              <Database size={18} className="icon-cyan" />
              <h2 id="buffer-inspector-title" className="card-title">BUFFERED MESH PACKETS</h2>
            </div>
            <span className="count-badge" id="buffer-count-badge">
              {messages.length} PACKETS
            </span>
          </div>

          <p className="card-subtitle">
            Packets received from upstream mesh relays. Original IDs, origin nodes, and hop histories are strictly preserved.
          </p>

          <div className="messages-list">
            {messages.length === 0 ? (
              <div className="empty-state">
                <Layers size={32} className="empty-icon" />
                <p>Mesh buffer empty. No emergency packets stored locally.</p>
                <span className="empty-hint">Broadcast an SOS or relay a packet to ingest it into this gateway.</span>
              </div>
            ) : (
              messages.map((msg) => {
                const isSynced =
                  msg.status === 'SYNCED_TO_GATEWAY' ||
                  msg.status === 'PROCESSED' ||
                  msg.status === 'DISPATCHED' ||
                  msg.status === 'RESOLVED';

                return (
                  <article key={msg.id} className="message-packet-card" data-id={msg.id}>
                    <div className="packet-header">
                      <span className="packet-id">{msg.id}</span>
                      <div className="packet-tags-group">
                        <span className={`priority-tag priority-${msg.priority.toLowerCase()}`}>
                          {msg.priority}
                        </span>
                        <span className={`status-pill ${isSynced ? 'pill-online' : 'pill-pending'}`}>
                          {isSynced ? '✓ SYNCED TO HQ' : 'PENDING UPLINK'}
                        </span>
                      </div>
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
                        {msg.peopleAffected} people
                      </span>
                    </div>

                    <p className="packet-body">{msg.message}</p>

                    <div className="packet-footer">
                      <div className="hop-trail">
                        <span className="hop-pill">ORIGIN: {msg.originNode}</span>
                        <span className="hop-pill">HOPS: {msg.hopCount}</span>
                        <span className="hop-pill">TYPE: {msg.type}</span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
