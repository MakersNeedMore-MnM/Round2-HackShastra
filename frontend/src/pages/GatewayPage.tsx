import React, { useState, useEffect, useCallback } from 'react';
import { 
  CloudUpload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  MapPin,
  Users
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
  const [syncStatus, setSyncStatus] = useState<'READY' | 'SYNCING' | 'SYNC COMPLETE' | 'SYNC FAILED'>('READY');
  const [feedback, setFeedback] = useState<string | null>(null);

  const refreshMessages = useCallback(async () => {
    try {
      const all = await getOutboxMessages();
      setMessages(all);
    } catch (err) {
      console.error('Error reading outbox:', err);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    const isOnline = await api.checkHealth();
    setBackendOnline(isOnline);
    return isOnline;
  }, []);

  useEffect(() => {
    const id = getOrCreateNodeId('morrowmesh_gateway_node_id');
    setNodeId(id);

    refreshMessages();
    checkHealth();

    const healthInterval = setInterval(checkHealth, 5000);

    const meshTransport = new BroadcastTransport();
    meshTransport.connect(id).then(() => {
      meshTransport.subscribe(async (event) => {
        if (event.type === 'MESSAGE_RECEIVED') {
          const incoming = event.message;
          const seen = await messageExists(incoming.id);
          if (!seen) {
            const updated: EmergencyMessage = {
              ...incoming,
              currentNode: id,
              hopCount: incoming.hopCount + 1,
              status: 'STORED_LOCALLY',
              history: [
                ...(incoming.history || []),
                { node_id: id, timestamp: Date.now(), action: 'received_at_gateway' },
              ],
            };
            await saveMessage(updated);
            refreshMessages();
          }
        }
      });
    });

    return () => {
      clearInterval(healthInterval);
      meshTransport.disconnect();
    };
  }, [checkHealth, refreshMessages]);

  const pendingMessages = messages.filter(
    (m) =>
      m.status !== 'SYNCED_TO_GATEWAY' &&
      m.status !== 'PROCESSED' &&
      m.status !== 'DISPATCHED' &&
      m.status !== 'RESOLVED'
  );

  const handleSync = async () => {
    if (pendingMessages.length === 0) {
      setFeedback('No pending messages to sync.');
      return;
    }

    setSyncStatus('SYNCING');
    setFeedback('Connecting to HQ and uplinking packets...');

    try {
      const isOnline = await checkHealth();
      if (!isOnline) {
        throw new Error('Backend offline. Messages remain safely stored on this device.');
      }

      const result = await api.syncMessages(pendingMessages);

      // Mark processed in IndexedDB
      const allDone = [...result.accepted, ...result.duplicates];
      for (const id of allDone) {
        await markMessageAsSynced(id);
      }

      setSyncStatus('SYNC COMPLETE');
      setFeedback(`✓ ${result.synced} message(s) ingested, ${result.duplicates.length} duplicate(s) verified.`);
      await refreshMessages();
    } catch (err) {
      setSyncStatus('SYNC FAILED');
      setFeedback((err as Error).message || 'Sync failed. Messages remain safely stored.');
    }
  };

  return (
    <div className="mobile-gateway-container">
      {/* Header */}
      <div className="gateway-header-bar">
        <div>
          <h1 className="gateway-page-title">GATEWAY</h1>
          <span className="gateway-identity">NODE: {nodeId}</span>
        </div>

        <div className="gateway-status-pill">
          <span className={`live-dot ${syncStatus === 'SYNC FAILED' ? 'dot-red' : 'dot-cyan'}`}></span>
          <span>{syncStatus === 'SYNCING' ? 'SYNCING...' : syncStatus === 'SYNC FAILED' ? 'SYNC FAILED' : '● READY TO SYNC'}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="gateway-metrics-grid">
        <div className="gateway-metric-card">
          <span className="gateway-metric-val">{pendingMessages.length}</span>
          <span className="gateway-metric-label">MESSAGES WAITING</span>
        </div>

        <div className={`gateway-metric-card ${backendOnline ? 'card-online' : 'card-offline'}`}>
          <span className="gateway-metric-val">{backendOnline ? 'ONLINE' : 'OFFLINE'}</span>
          <span className="gateway-metric-label">BACKEND</span>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="gateway-primary-action">
        <button
          type="button"
          id="sync-to-hq-btn"
          disabled={syncStatus === 'SYNCING'}
          onClick={handleSync}
          className="btn-sync-to-hq"
        >
          <CloudUpload size={22} />
          <span>{syncStatus === 'SYNCING' ? 'SYNCING TO HQ...' : 'SYNC TO HQ'}</span>
        </button>

        {feedback && (
          <div className={`sync-feedback-banner ${syncStatus === 'SYNC FAILED' ? 'banner-failed' : 'banner-success'}`}>
            {syncStatus === 'SYNC FAILED' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{feedback}</span>
          </div>
        )}
      </div>

      {/* Buffered Messages List */}
      <section className="gateway-card">
        <div className="card-header-simple">
          <h2 className="section-heading">BUFFERED MESSAGES ({messages.length})</h2>
          <button type="button" onClick={refreshMessages} className="btn-compact">
            <RefreshCw size={12} />
            <span>REFRESH</span>
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="empty-state-simple">
            <p>No messages buffered in gateway storage.</p>
            <span className="text-dim">Messages relayed from nearby phones will buffer here.</span>
          </div>
        ) : (
          <div className="gateway-messages-list">
            {messages.map((msg) => {
              const isSynced =
                msg.status === 'SYNCED_TO_GATEWAY' ||
                msg.status === 'PROCESSED' ||
                msg.status === 'DISPATCHED' ||
                msg.status === 'RESOLVED';

              return (
                <div key={msg.id} className="gateway-packet-item">
                  <div className="gateway-packet-top">
                    <span className="packet-id">{msg.id}</span>
                    <span className={`status-pill ${isSynced ? 'pill-online' : 'pill-pending'}`}>
                      {isSynced ? 'SYNCED' : 'WAITING'}
                    </span>
                  </div>

                  <p className="packet-body">{msg.message}</p>

                  <div className="packet-meta">
                    <span className="meta-item"><Clock size={12} />{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    <span className="meta-item"><MapPin size={12} />{msg.location}</span>
                    <span className="meta-item"><Users size={12} />{msg.peopleAffected}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {onNavigateToHq && (
        <div className="gateway-footer-nav">
          <button type="button" onClick={onNavigateToHq} className="btn-secondary-action w-full">
            <span>GO TO COMMAND HQ →</span>
          </button>
        </div>
      )}
    </div>
  );
};
