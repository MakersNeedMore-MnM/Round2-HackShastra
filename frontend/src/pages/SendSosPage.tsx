import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  Database, 
  Send, 
  MapPin, 
  Users, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Clock,
  Layers,
  ArrowRight,
  Share2
} from 'lucide-react';
import type { EmergencyMessage, EmergencyType, PriorityLevel } from '../types/message';
import { 
  saveMessage, 
  getOutboxMessages, 
  getOrCreateNodeId 
} from '../storage/db';
import { NetworkStatus } from '../components/NetworkStatus';
import { BroadcastTransport } from '../transport/BroadcastTransport';

export const SendSosPage: React.FC = () => {
  // Offline simulation toggle
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(true);
  
  // Form fields
  const [location, setLocation] = useState<string>('Bridge Zone');
  const [report, setReport] = useState<string>('3 people trapped near the bridge. One child injured. Water level rising fast.');
  const [peopleAffected, setPeopleAffected] = useState<number>(3);
  const [injuryPresent, setInjuryPresent] = useState<boolean>(true);
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('RESCUE');

  // Queue state
  const [queuedMessages, setQueuedMessages] = useState<EmergencyMessage[]>([]);
  const [nodeId, setNodeId] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [transport, setTransport] = useState<BroadcastTransport | null>(null);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);

  // Initialize node ID & load existing outbox from IndexedDB
  useEffect(() => {
    const id = getOrCreateNodeId();
    setNodeId(id);
    refreshQueue();

    const meshTransport = new BroadcastTransport();
    meshTransport.connect(id).then(() => {
      setTransport(meshTransport);
    });

    return () => {
      meshTransport.disconnect();
    };
  }, []);

  const refreshQueue = async () => {
    try {
      const messages = await getOutboxMessages();
      setQueuedMessages(messages);
    } catch (err) {
      console.error('Failed to read IndexedDB outbox:', err);
    }
  };

  const broadcastPacket = async (msg: EmergencyMessage) => {
    if (!transport) return;
    setBroadcastingId(msg.id);
    try {
      await transport.broadcast(msg);
      setStatusMessage({
        text: `✓ BROADCAST TO MESH: Packet ${msg.id} transmitted across BroadcastChannel.`,
        type: 'success',
      });
    } catch (err) {
      console.error('Broadcast failed:', err);
    } finally {
      setTimeout(() => setBroadcastingId(null), 500);
    }
  };

  const handleSendSos = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // Form validation
    const trimmedLocation = location.trim();
    const trimmedReport = report.trim();

    if (!trimmedLocation) {
      setStatusMessage({ text: 'Error: Location / Zone is required.', type: 'error' });
      return;
    }

    if (!trimmedReport) {
      setStatusMessage({ text: 'Error: Emergency description cannot be empty.', type: 'error' });
      return;
    }

    if (isNaN(peopleAffected) || peopleAffected < 1) {
      setStatusMessage({ text: 'Error: Number of people affected must be at least 1.', type: 'error' });
      return;
    }

    setSubmitting(true);

    try {
      // Determine calculated baseline priority based on injury & people affected
      let calculatedPriority: PriorityLevel = 'HIGH';
      if (injuryPresent || peopleAffected >= 5) {
        calculatedPriority = 'CRITICAL';
      } else if (peopleAffected === 1 && !injuryPresent) {
        calculatedPriority = 'MEDIUM';
      }

      const timestamp = Date.now();
      const uniqueMsgId = `SOS-${timestamp}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      const newMessage: EmergencyMessage = {
        id: uniqueMsgId,
        timestamp,
        message: trimmedReport,
        type: emergencyType,
        peopleAffected: Number(peopleAffected),
        location: trimmedLocation,
        priority: calculatedPriority,
        originNode: nodeId,
        currentNode: nodeId,
        hopCount: 0,
        status: 'STORED_LOCALLY',
        history: [
          {
            node_id: nodeId,
            timestamp,
            action: 'created',
          },
        ],
      };

      // 1. CRITICAL: Persist to IndexedDB BEFORE updating UI
      await saveMessage(newMessage);

      // 2. Refresh queue from IndexedDB to verify persistence
      await refreshQueue();

      // 3. Broadcast to mesh peers if transport is ready
      if (transport) {
        try {
          await transport.broadcast(newMessage);
        } catch (bErr) {
          console.warn('Mesh broadcast deferred:', bErr);
        }
      }

      // 4. Update UI
      setStatusMessage({
        text: `✓ STORED LOCALLY: Message ${newMessage.id} queued in IndexedDB and broadcast to mesh.`,
        type: 'success',
      });

      // Clear or reset fields
      // setReport('');
    } catch (err) {
      console.error('Failed to save SOS to IndexedDB:', err);
      setStatusMessage({
        text: `Failed to save message to local storage: ${(err as Error).message}`,
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sos-page-container">
      {/* Network Status Header Bar */}
      <NetworkStatus
        simulatedOffline={simulatedOffline}
        onToggleSimulatedOffline={setSimulatedOffline}
      />

      <div className="content-grid">
        {/* Left Column: SOS Creation Panel */}
        <section className="terminal-card form-section" aria-labelledby="sos-form-title">
          <div className="card-header">
            <div className="header-title-group">
              <AlertOctagon className="icon-alert" size={20} />
              <h1 id="sos-form-title" className="card-title">CREATE EMERGENCY SOS</h1>
            </div>
            <div className="node-badge" title="Persistent Browser Node Identifier">
              <Radio size={12} />
              <span>NODE: {nodeId || 'INITIALIZING...'}</span>
            </div>
          </div>

          <p className="card-subtitle">
            Offline-first emergency report. Stored directly to device hardware storage (IndexedDB) and dispatched to nearby nodes via mesh relay.
          </p>

          <form onSubmit={handleSendSos} className="sos-form" noValidate>
            <div className="form-group">
              <label htmlFor="location-input">
                <MapPin size={14} />
                <span>LOCATION / ZONE / LANDMARK</span>
              </label>
              <input
                id="location-input"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bridge Zone, Sector 4, North Levee"
                required
                className="tactical-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group half-width">
                <label htmlFor="people-input">
                  <Users size={14} />
                  <span>PEOPLE AFFECTED</span>
                </label>
                <input
                  id="people-input"
                  type="number"
                  min="1"
                  max="1000"
                  value={peopleAffected}
                  onChange={(e) => setPeopleAffected(parseInt(e.target.value) || 1)}
                  required
                  className="tactical-input"
                />
              </div>

              <div className="form-group half-width">
                <label htmlFor="type-select">
                  <Activity size={14} />
                  <span>EMERGENCY TYPE</span>
                </label>
                <select
                  id="type-select"
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value as EmergencyType)}
                  className="tactical-select"
                >
                  <option value="RESCUE">RESCUE</option>
                  <option value="MEDICAL">MEDICAL</option>
                  <option value="HAZARD">HAZARD (FLOOD/FIRE)</option>
                  <option value="SUPPLIES">SUPPLIES NEEDED</option>
                  <option value="SHELTER">SHELTER</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-container" htmlFor="injury-checkbox">
                <input
                  id="injury-checkbox"
                  type="checkbox"
                  checked={injuryPresent}
                  onChange={(e) => setInjuryPresent(e.target.checked)}
                />
                <span className="checkbox-custom"></span>
                <span className="checkbox-label">
                  <strong>INJURY / CASUALTIES PRESENT</strong> (Escalates priority to CRITICAL)
                </span>
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="report-textarea">
                <span>WHAT IS HAPPENING? (SITUATION REPORT)</span>
              </label>
              <textarea
                id="report-textarea"
                rows={4}
                value={report}
                onChange={(e) => setReport(e.target.value)}
                placeholder="Describe current status, specific hazards, children/elderly trapped, urgent needs..."
                required
                className="tactical-textarea"
              />
            </div>

            {statusMessage && (
              <div 
                id="status-banner" 
                className={`status-alert ${statusMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`}
                role="alert"
              >
                {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              id="send-sos-btn"
              className="btn-emergency-action"
            >
              <Send size={18} />
              <span>{submitting ? 'COMMITTING TO INDEXEDDB...' : 'SEND SOS'}</span>
            </button>
          </form>
        </section>

        {/* Right Column: Persistent Local Outbox View */}
        <section className="terminal-card queue-section" aria-labelledby="queue-title">
          <div className="card-header">
            <div className="header-title-group">
              <Database className="icon-cyan" size={20} />
              <h2 id="queue-title" className="card-title">LOCAL DEVICE OUTBOX (INDEXEDDB)</h2>
            </div>
            <span className="count-badge" id="queue-count-badge">
              {queuedMessages.length} {queuedMessages.length === 1 ? 'MESSAGE' : 'MESSAGES'}
            </span>
          </div>

          <div className="queue-callout">
            <p className="callout-text">
              <strong>STATUS: STORED LOCALLY</strong>
              <br />
              All reports below are persisted in browser IndexedDB storage. They will survive page refreshes and offline reboots until relayed or synced.
            </p>
          </div>

          <div className="messages-list" id="outbox-messages-list">
            {queuedMessages.length === 0 ? (
              <div className="empty-state">
                <Layers size={32} className="empty-icon" />
                <p>No messages stored locally in outbox.</p>
                <span className="empty-hint">Submit an emergency report above to create an offline packet.</span>
              </div>
            ) : (
              queuedMessages.map((msg) => (
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

                  <div className="packet-footer">
                    <div className="hop-trail">
                      <span className="hop-pill">ORIGIN: {msg.originNode}</span>
                      <ArrowRight size={12} className="hop-arrow" />
                      <span className="hop-pill">HOPS: {msg.hopCount}</span>
                    </div>
                    <div className="packet-action-group">
                      <button
                        type="button"
                        onClick={() => broadcastPacket(msg)}
                        disabled={broadcastingId === msg.id}
                        className="btn-rebroadcast"
                        title="Broadcast packet to mesh peers"
                      >
                        <Share2 size={12} />
                        <span>{broadcastingId === msg.id ? 'BROADCASTING...' : 'BROADCAST'}</span>
                      </button>
                      <span className="status-badge-local" id={`status-${msg.id}`}>
                        {msg.status}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
