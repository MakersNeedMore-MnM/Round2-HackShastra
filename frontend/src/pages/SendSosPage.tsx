import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  Flame, 
  Droplets, 
  HeartPulse, 
  AlertOctagon, 
  Car, 
  HelpCircle,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import type { EmergencyMessage, EmergencyType } from '../types/message';
import { 
  saveMessage, 
  getOutboxMessages, 
  getOrCreateNodeId 
} from '../storage/db';
import { BroadcastTransport } from '../transport/BroadcastTransport';

type QuickType = 'FIRE' | 'FLOOD' | 'MEDICAL' | 'TRAPPED' | 'ACCIDENT' | 'OTHER';

const QUICK_TYPES: { id: QuickType; label: string; icon: React.ReactNode; schemaType: EmergencyType }[] = [
  { id: 'MEDICAL', label: 'MEDICAL', icon: <HeartPulse size={16} />, schemaType: 'MEDICAL' },
  { id: 'TRAPPED', label: 'TRAPPED', icon: <AlertOctagon size={16} />, schemaType: 'RESCUE' },
  { id: 'FLOOD', label: 'FLOOD', icon: <Droplets size={16} />, schemaType: 'HAZARD' },
  { id: 'FIRE', label: 'FIRE', icon: <Flame size={16} />, schemaType: 'HAZARD' },
  { id: 'ACCIDENT', label: 'ACCIDENT', icon: <Car size={16} />, schemaType: 'RESCUE' },
  { id: 'OTHER', label: 'OTHER', icon: <HelpCircle size={16} />, schemaType: 'OTHER' },
];

export const SendSosPage: React.FC = () => {
  const [nodeId, setNodeId] = useState<string>('');
  const [transport, setTransport] = useState<BroadcastTransport | null>(null);
  
  // Geolocation state
  const [locationAvailable, setLocationAvailable] = useState<boolean>(false);
  const [coordsLocation, setCoordsLocation] = useState<string>('LOCATION UNAVAILABLE');
  const [locationDetecting, setLocationDetecting] = useState<boolean>(true);

  // SOS state
  const [activeSos, setActiveSos] = useState<EmergencyMessage | null>(null);
  const [recentSosList, setRecentSosList] = useState<EmergencyMessage[]>([]);
  const [sending, setSending] = useState<boolean>(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // Optional details fields
  const [selectedQuickType, setSelectedQuickType] = useState<QuickType>('OTHER');
  const [optionalMessage, setOptionalMessage] = useState<string>('');
  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [detailsSaved, setDetailsSaved] = useState<boolean>(false);

  // 1. Refresh recent messages sent on this device
  const refreshOutbox = useCallback(async () => {
    try {
      const messages = await getOutboxMessages();
      setRecentSosList(messages);
      if (!activeSos && messages.length > 0) {
        const latest = messages[0];
        // If sent within the last 2 hours, show as active SOS
        if (Date.now() - latest.timestamp < 2 * 60 * 60 * 1000) {
          setActiveSos(latest);
        }
      }
    } catch (err) {
      console.error('Failed to read IndexedDB outbox:', err);
    }
  }, [activeSos]);

  // 2. Request Geolocation automatically (Never blocks SOS)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(4);
          const lon = position.coords.longitude.toFixed(4);
          setCoordsLocation(`${lat}° N, ${lon}° E`);
          setLocationAvailable(true);
          setLocationDetecting(false);
        },
        () => {
          setCoordsLocation('LOCATION UNAVAILABLE');
          setLocationAvailable(false);
          setLocationDetecting(false);
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    } else {
      setCoordsLocation('LOCATION UNAVAILABLE');
      setLocationAvailable(false);
      setLocationDetecting(false);
    }
  }, []);

  // 3. Initialize Node & Transport
  useEffect(() => {
    const id = getOrCreateNodeId();
    setNodeId(id);
    refreshOutbox();

    const meshTransport = new BroadcastTransport();
    meshTransport.connect(id).then(() => {
      setTransport(meshTransport);
    });

    return () => {
      meshTransport.disconnect();
    };
  }, [refreshOutbox]);

  // 4. ONE-TAP EMERGENCY SOS ACTION
  const handleTriggerSos = async () => {
    setSending(true);
    setSavedFeedback(null);
    setDetailsSaved(false);

    try {
      const timestamp = Date.now();
      const uniqueMsgId = `SOS-${timestamp}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const newSosMessage: EmergencyMessage = {
        id: uniqueMsgId,
        timestamp,
        message: 'EMERGENCY SOS: Immediate assistance required.',
        type: 'OTHER',
        peopleAffected: 1,
        location: coordsLocation,
        priority: 'CRITICAL',
        originNode: nodeId || 'NODE-CITIZEN',
        currentNode: nodeId || 'NODE-CITIZEN',
        hopCount: 0,
        status: 'STORED_LOCALLY',
        history: [
          {
            node_id: nodeId || 'NODE-CITIZEN',
            timestamp,
            action: 'created',
          },
        ],
      };

      // Guaranteed IndexedDB hardware storage first
      await saveMessage(newSosMessage);

      // Broadcast across peer mesh transport
      if (transport) {
        try {
          await transport.broadcast(newSosMessage);
        } catch (bErr) {
          console.warn('Mesh broadcast deferred:', bErr);
        }
      }

      setActiveSos(newSosMessage);
      await refreshOutbox();
    } catch (err) {
      console.error('Failed to save SOS:', err);
    } finally {
      setSending(false);
    }
  };

  // 5. SAVE OPTIONAL DETAILS (Never blocks initial SOS)
  const handleSaveOptionalDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSos) return;

    try {
      const matched = QUICK_TYPES.find((t) => t.id === selectedQuickType);
      const schemaType = matched ? matched.schemaType : 'OTHER';

      const detailPrefix = selectedQuickType !== 'OTHER' ? `[${selectedQuickType}] ` : '';
      const finalMessage = optionalMessage.trim()
        ? `${detailPrefix}${optionalMessage.trim()}`
        : `${detailPrefix}Immediate assistance required.`;

      const updatedSos: EmergencyMessage = {
        ...activeSos,
        type: schemaType,
        peopleAffected: Math.max(1, Number(peopleCount) || 1),
        message: finalMessage,
      };

      await saveMessage(updatedSos);

      if (transport) {
        try {
          await transport.broadcast(updatedSos);
        } catch (bErr) {
          console.warn('Rebroadcast failed:', bErr);
        }
      }

      setActiveSos(updatedSos);
      setDetailsSaved(true);
      setSavedFeedback('✓ Details saved and dispatched to mesh.');
      await refreshOutbox();
    } catch (err) {
      console.error('Failed to update details:', err);
    }
  };

  // Determine user-friendly SOS status
  const getSosStatusText = (status?: string) => {
    if (status === 'SYNCED_TO_GATEWAY' || status === 'PROCESSED' || status === 'DISPATCHED' || status === 'RESOLVED') {
      return 'SOS SYNCED';
    }
    if (status === 'RELAYED') {
      return 'SOS RELAYING';
    }
    return 'SOS STORED';
  };

  return (
    <div className="mobile-sos-container">
      {/* Network Status & Location Header */}
      <div className="mobile-header-bar">
        <div className="network-pill">
          <span className="live-dot"></span>
          <span>OFFLINE MODE</span>
        </div>

        <div className="location-pill" title={coordsLocation}>
          <MapPin size={12} />
          <span>
            {locationDetecting
              ? 'LOCATION: Detecting...'
              : locationAvailable
              ? 'LOCATION: ✓ Location attached'
              : 'LOCATION: Not available'}
          </span>
        </div>
      </div>

      {/* Primary Emergency View */}
      {!activeSos ? (
        <section className="sos-hero-card">
          <div className="sos-prompt-header">
            <h1 className="sos-main-heading">ARE YOU IN DANGER?</h1>
            <p className="sos-sub-heading">
              Tap below to immediately broadcast an emergency signal to nearby participating phones.
            </p>
          </div>

          <div className="sos-action-wrapper">
            <button
              type="button"
              id="send-sos-btn"
              disabled={sending}
              onClick={handleTriggerSos}
              className="btn-sos-trigger"
              aria-label="Send Emergency SOS Now"
            >
              <div className="sos-button-pulse"></div>
              <div className="sos-button-inner">
                <AlertTriangle size={40} className="sos-btn-icon" />
                <span className="sos-btn-text">{sending ? 'STORING...' : 'SEND SOS'}</span>
                <span className="sos-btn-sub">ONE TAP EMERGENCY SIGNAL</span>
              </div>
            </button>
          </div>

          <div className="sos-quick-reassurance">
            <p>
              🔒 <strong>Offline Store-and-Forward:</strong> Your message is immediately saved to this phone hardware and will hop through nearby phones until it reaches help.
            </p>
          </div>
        </section>
      ) : (
        /* State 2: Emergency Confirmation & Optional Details */
        <div className="sos-active-flow">
          {/* Confirmation Card */}
          <section className="sos-confirmation-card">
            <div className="confirmation-header">
              <div className="confirmation-title-row">
                <CheckCircle2 size={26} className="icon-success" />
                <div>
                  <h2 className="confirmation-title">SOS STORED</h2>
                  <span className="sos-badge-tag">{getSosStatusText(activeSos.status)}</span>
                </div>
              </div>
              <span className="priority-tag priority-critical">CRITICAL</span>
            </div>

            <div className="confirmation-status-box">
              <div className="status-indicator-line">
                <span className="status-check">✓</span>
                <span>Saved on this device (IndexedDB)</span>
              </div>
              <div className="status-indicator-line">
                <span className="status-check">✓</span>
                <span>Ready to relay to nearby MorrowMesh nodes</span>
              </div>
            </div>

            <div className="offline-notice-callout">
              <strong>OFFLINE MODE:</strong> Your emergency message is safely stored on this device. When another participating device is nearby, it will relay onward.
            </div>

            <button
              type="button"
              onClick={handleTriggerSos}
              disabled={sending}
              className="btn-compact btn-send-another"
            >
              <RefreshCw size={12} />
              <span>SEND ANOTHER SOS</span>
            </button>
          </section>

          {/* Optional Details Form: HELP RESCUERS */}
          <section className="sos-optional-card">
            <div className="optional-card-header">
              <h3 className="optional-title">HELP RESCUERS</h3>
              <span className="optional-badge">OPTIONAL</span>
            </div>

            <p className="optional-subtitle">
              What happened? Tap a category to help responders bring the right equipment:
            </p>

            <form onSubmit={handleSaveOptionalDetails} className="optional-form">
              <div className="form-group-mobile">
                <div className="quick-types-grid">
                  {QUICK_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedQuickType(t.id)}
                      className={`btn-quick-type ${selectedQuickType === t.id ? 'active' : ''}`}
                    >
                      {t.icon}
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group-mobile">
                <label htmlFor="people-count-mobile" className="input-label-mobile">
                  PEOPLE NEEDING HELP
                </label>
                <div className="people-stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setPeopleCount((p) => Math.max(1, p - 1))}
                  >
                    -
                  </button>
                  <input
                    id="people-count-mobile"
                    type="number"
                    min="1"
                    max="100"
                    value={peopleCount}
                    onChange={(e) => setPeopleCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="stepper-input"
                  />
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setPeopleCount((p) => p + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="form-group-mobile">
                <label htmlFor="optional-message-input" className="input-label-mobile">
                  OPTIONAL MESSAGE
                </label>
                <textarea
                  id="optional-message-input"
                  rows={3}
                  value={optionalMessage}
                  onChange={(e) => setOptionalMessage(e.target.value)}
                  placeholder="Tell rescuers anything important (e.g. water rising, trapped on 2nd floor)..."
                  className="mobile-textarea"
                />
              </div>

              {savedFeedback && (
                <div className="saved-feedback-banner">
                  <CheckCircle2 size={14} />
                  <span>{savedFeedback}</span>
                </div>
              )}

              <div className="optional-form-actions">
                <button
                  type="submit"
                  className="btn-save-details"
                  id="save-details-btn"
                >
                  <span>{detailsSaved ? 'UPDATE DETAILS' : 'SAVE DETAILS'}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Simple Active Device Summary */}
      {recentSosList.length > 0 && (
        <section className="mobile-history-card">
          <div className="history-header">
            <span className="history-title">RECENT SOS ON THIS DEVICE</span>
            <span className="history-count">{recentSosList.length}</span>
          </div>

          <div className="history-list">
            {recentSosList.slice(0, 3).map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-item-top">
                  <span className="history-status-pill">{getSosStatusText(item.status)}</span>
                  <span className="history-item-time">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="history-item-text">{item.message}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
