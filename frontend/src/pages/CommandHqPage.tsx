import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Truck,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import type { EmergencyMessage, ZoneIncident } from '../types/message';
import { api, ApiError } from '../services/api';
import { MeshTopologyVisualizer } from '../components/MeshTopologyVisualizer';

interface CommandHqPageProps {
  onNavigateToGateway?: () => void;
}

export const CommandHqPage: React.FC<CommandHqPageProps> = ({ onNavigateToGateway }) => {
  const [messages, setMessages] = useState<EmergencyMessage[]>([]);
  const [incidents, setIncidents] = useState<ZoneIncident[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const isOnline = await api.checkHealth();
      setBackendOnline(isOnline);

      if (isOnline) {
        const [msgData, incData] = await Promise.all([
          api.getMessages(),
          api.getIncidents(),
        ]);
        setMessages(msgData);
        setIncidents(incData);
      }
    } catch (err) {
      console.error('Error loading HQ data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleStatusUpdate = async (
    messageId: string,
    newStatus: 'PROCESSED' | 'DISPATCHED' | 'RESOLVED',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setActionInProgressId(messageId);
    setFeedback(null);

    try {
      const updated = await api.updateMessageStatus(messageId, newStatus);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: updated.status } : m))
      );
      setFeedback({ text: `✓ Status updated to ${newStatus}` });
      setTimeout(() => setFeedback(null), 3000);

      const incData = await api.getIncidents();
      setIncidents(incData);
    } catch (err) {
      const errText = err instanceof ApiError ? err.message : (err as Error).message;
      setFeedback({ text: `Failed to update: ${errText}`, error: true });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset central backend state for testing?')) return;
    try {
      await api.resetBackend();
      await loadData();
      setFeedback({ text: 'HQ state cleared.' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      setFeedback({ text: (err as Error).message, error: true });
    }
  };

  const totalIncidents = messages.length;
  const criticalCount = messages.filter((m) => m.priority === 'CRITICAL').length;
  const totalPeople = messages.reduce((acc, m) => acc + (m.peopleAffected || 0), 0);
  const dispatchedCount = messages.filter((m) => m.status === 'DISPATCHED' || m.status === 'RESOLVED').length;

  return (
    <div className="mobile-hq-container">
      {/* Header */}
      <div className="hq-header-bar">
        <div>
          <h1 className="hq-page-title">COMMAND HQ</h1>
          <span className="hq-subtitle">INCIDENT COMMAND SYSTEM</span>
        </div>

        <div className={`hq-status-pill ${backendOnline ? 'pill-online' : 'pill-offline'}`}>
          <span className={`live-dot ${backendOnline ? 'dot-green' : 'dot-red'}`}></span>
          <span>{backendOnline ? '● NETWORK ONLINE' : '● NETWORK OFFLINE'}</span>
        </div>
      </div>

      {/* Top Summary KPI Cards */}
      <div className="hq-kpi-grid">
        <div className="hq-kpi-card">
          <span className="hq-kpi-val">{totalIncidents}</span>
          <span className="hq-kpi-label">ACTIVE INCIDENTS</span>
        </div>
        <div className="hq-kpi-card kpi-critical">
          <span className="hq-kpi-val">{criticalCount}</span>
          <span className="hq-kpi-label">CRITICAL</span>
        </div>
        <div className="hq-kpi-card">
          <span className="hq-kpi-val">{totalPeople}</span>
          <span className="hq-kpi-label">PEOPLE AFFECTED</span>
        </div>
        <div className="hq-kpi-card kpi-dispatched">
          <span className="hq-kpi-val">{dispatchedCount}</span>
          <span className="hq-kpi-label">DISPATCHED</span>
        </div>
      </div>

      {feedback && (
        <div className={`status-alert ${feedback.error ? 'alert-danger' : 'alert-success'}`} role="alert">
          {feedback.error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Zone Aggregation Summary */}
      {incidents.length > 0 && (
        <section className="hq-card">
          <div className="card-header-simple">
            <h2 className="section-heading">ZONES ({incidents.length})</h2>
            <button type="button" onClick={loadData} className="btn-compact">
              <RefreshCw size={12} className={loading ? 'spin-icon' : ''} />
              <span>REFRESH</span>
            </button>
          </div>

          <div className="zone-summary-grid">
            {incidents.map((inc) => (
              <div key={inc.zone} className="zone-summary-pill">
                <div className="zone-pill-top">
                  <span className="zone-pill-name">{inc.zone}</span>
                  <span className={`priority-tag priority-${inc.overallPriority.toLowerCase()}`}>
                    {inc.overallPriority}
                  </span>
                </div>
                <div className="zone-pill-stats">
                  <span>{inc.reports} reports</span>
                  <span>•</span>
                  <span>{inc.peopleAffected} people</span>
                  <span>•</span>
                  <span>{new Date(inc.latestTimestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Incidents List */}
      <section className="hq-card">
        <div className="card-header-simple">
          <h2 className="section-heading">ACTIVE INCIDENTS ({messages.length})</h2>
          <span className="text-dim">Tap card to view details</span>
        </div>

        {messages.length === 0 ? (
          <div className="empty-state-simple">
            <ShieldAlert size={32} className="empty-icon" />
            <p>No active incidents received from gateways.</p>
            <span className="text-dim">Sync messages from a Gateway node to ingest incidents.</span>
          </div>
        ) : (
          <div className="hq-incident-list">
            {messages.map((msg) => {
              const isExpanded = expandedId === msg.id;
              const isBusy = actionInProgressId === msg.id;

              return (
                <article
                  key={msg.id}
                  onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                  className={`incident-mobile-card border-${msg.priority.toLowerCase()} ${isExpanded ? 'expanded' : ''}`}
                >
                  <div className="incident-card-top">
                    <div>
                      <span className={`priority-tag priority-${msg.priority.toLowerCase()}`}>
                        {msg.priority}
                      </span>
                      <span className="incident-zone-title">{msg.location}</span>
                    </div>

                    <div className="incident-top-right">
                      <span className={`status-pill status-${msg.status.toLowerCase()}`}>
                        {msg.status}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  <div className="incident-meta-row">
                    <span>{msg.type}</span>
                    <span>•</span>
                    <span>{msg.peopleAffected} {msg.peopleAffected === 1 ? 'PERSON' : 'PEOPLE'}</span>
                    <span>•</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <p className="incident-card-body">{msg.message}</p>

                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <div className="incident-detail-panel" onClick={(e) => e.stopPropagation()}>
                      <div className="detail-row">
                        <span className="detail-label">MESSAGE ID:</span>
                        <span className="detail-val font-mono">{msg.id}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">EMERGENCY TYPE:</span>
                        <span className="detail-val">{msg.type}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">LOCATION / ZONE:</span>
                        <span className="detail-val">{msg.location}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">PEOPLE AFFECTED:</span>
                        <span className="detail-val">{msg.peopleAffected}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">ORIGIN NODE:</span>
                        <span className="detail-val font-mono">{msg.originNode}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">RELAY PATH:</span>
                        <span className="detail-val font-mono">
                          {msg.history && msg.history.length > 0
                            ? msg.history.map((h) => h.node_id).join(' → ')
                            : msg.originNode}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">TOTAL HOPS:</span>
                        <span className="detail-val">{msg.hopCount}</span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="incident-card-actions">
                    <button
                      type="button"
                      disabled={isBusy || msg.status === 'PROCESSED'}
                      onClick={(e) => handleStatusUpdate(msg.id, 'PROCESSED', e)}
                      className={`btn-triage btn-triage-process ${msg.status === 'PROCESSED' ? 'active' : ''}`}
                    >
                      <CheckCircle2 size={12} />
                      <span>PROCESSED</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || msg.status === 'DISPATCHED'}
                      onClick={(e) => handleStatusUpdate(msg.id, 'DISPATCHED', e)}
                      className={`btn-triage btn-triage-dispatch ${msg.status === 'DISPATCHED' ? 'active' : ''}`}
                    >
                      <Truck size={12} />
                      <span>DISPATCHED</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || msg.status === 'RESOLVED'}
                      onClick={(e) => handleStatusUpdate(msg.id, 'RESOLVED', e)}
                      className={`btn-triage btn-triage-resolve ${msg.status === 'RESOLVED' ? 'active' : ''}`}
                    >
                      <CheckCircle2 size={12} />
                      <span>RESOLVED</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Topology Graph */}
      <section className="hq-card">
        <MeshTopologyVisualizer autoRefreshInterval={6000} />
      </section>

      {/* Footer Tools */}
      <div className="hq-footer-tools">
        {onNavigateToGateway && (
          <button type="button" onClick={onNavigateToGateway} className="btn-compact">
            <span>GATEWAY UPLINK</span>
          </button>
        )}
        <button type="button" onClick={handleReset} className="btn-compact btn-danger-subtle">
          <RotateCcw size={12} />
          <span>RESET HQ</span>
        </button>
      </div>
    </div>
  );
};
