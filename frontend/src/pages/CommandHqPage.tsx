import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  MapPin,
  Users,
  Clock,
  RefreshCw,
  Server,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Truck,
  Layers,
  ArrowRight,
  Filter,
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
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const isOnline = await api.checkHealth();
      setBackendOnline(isOnline);

      if (!isOnline) {
        setLoading(false);
        return;
      }

      const [msgData, incData] = await Promise.all([
        api.getMessages({
          priority: filterPriority || undefined,
          status: filterStatus || undefined,
        }),
        api.getIncidents(),
      ]);

      setMessages(msgData);
      setIncidents(incData);
    } catch (err) {
      console.error('Error loading HQ data:', err);
    } finally {
      setLoading(false);
    }
  }, [filterPriority, filterStatus]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Triage status updater: PATCH /api/messages/{id}/status
  const handleStatusUpdate = async (
    messageId: string,
    newStatus: 'PROCESSED' | 'DISPATCHED' | 'RESOLVED'
  ) => {
    setActionInProgressId(messageId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updated = await api.updateMessageStatus(messageId, newStatus);
      
      // Update local state directly
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: updated.status } : m))
      );

      setActionSuccess(`✓ Packet ${messageId} status set to ${newStatus}`);
      setTimeout(() => setActionSuccess(null), 4000);

      // Refresh incidents to sync zone status
      const incData = await api.getIncidents();
      setIncidents(incData);
    } catch (err) {
      const errorMsg =
        err instanceof ApiError ? err.message : (err as Error).message || 'Failed to update status';
      setActionError(`Failed to update ${messageId}: ${errorMsg}`);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleResetBackend = async () => {
    if (!window.confirm('Reset all ingested messages on the backend?')) return;
    try {
      await api.resetBackend();
      await loadData();
      setActionSuccess('Backend state reset successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError(`Reset failed: ${(err as Error).message}`);
    }
  };

  // Metrics summary
  const totalReports = messages.length;
  const totalAffected = messages.reduce((acc, m) => acc + (m.peopleAffected || 0), 0);
  const criticalCount = messages.filter((m) => m.priority === 'CRITICAL').length;
  const dispatchedCount = messages.filter((m) => m.status === 'DISPATCHED' || m.status === 'RESOLVED').length;

  return (
    <div className="command-hq-container">
      {/* Top Tactical Status Bar */}
      <div className="hq-status-bar">
        <div className="hq-meta-group">
          <div className="hq-badge">
            <ShieldAlert size={14} className="icon-alert" />
            <span>CENTRAL INCIDENT COMMAND HQ</span>
          </div>

          <div className={`hq-badge ${backendOnline ? 'badge-ok' : 'badge-danger'}`}>
            <Server size={14} />
            <span>HQ BACKEND: <strong>{backendOnline ? 'ONLINE' : 'OFFLINE'}</strong></span>
          </div>
        </div>

        <div className="hq-actions-group">
          {onNavigateToGateway && (
            <button
              type="button"
              onClick={onNavigateToGateway}
              className="btn-compact"
              title="Switch to Gateway Uplink view"
            >
              <ArrowRight size={12} />
              <span>GATEWAY UPLINK</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="btn-compact"
            title="Refresh Central Store"
          >
            <RefreshCw size={12} className={loading ? 'spin-icon' : ''} />
            <span>{loading ? 'REFRESHING...' : 'REFRESH'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetBackend}
            className="btn-compact btn-danger-subtle"
            title="Clear backend store for testing"
          >
            <RotateCcw size={12} />
            <span>RESET HQ</span>
          </button>
        </div>
      </div>

      {/* KPI Ticker Row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">TOTAL INGESTED REPORTS</span>
          <span className="kpi-value">{totalReports}</span>
          <span className="kpi-sub">Across all mesh gateways</span>
        </div>

        <div className="kpi-card kpi-alert">
          <span className="kpi-label">PEOPLE REPORTED AFFECTED</span>
          <span className="kpi-value">{totalAffected}</span>
          <span className="kpi-sub">Field casualties &amp; trapped persons</span>
        </div>

        <div className="kpi-card kpi-critical">
          <span className="kpi-label">CRITICAL PRIORITY ALERTS</span>
          <span className="kpi-value">{criticalCount}</span>
          <span className="kpi-sub">Immediate life hazard / severe injury</span>
        </div>

        <div className="kpi-card kpi-dispatched">
          <span className="kpi-label">DISPATCHED / RESOLVED</span>
          <span className="kpi-value">{dispatchedCount}</span>
          <span className="kpi-sub">Field units deployed or cleared</span>
        </div>
      </div>

      {/* Action alerts */}
      {actionSuccess && (
        <div className="status-alert alert-success" role="alert">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="status-alert alert-danger" role="alert">
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Section 1: Real Zone Aggregation Cards */}
      <section className="terminal-card" aria-labelledby="zone-summary-title">
        <div className="card-header">
          <div className="header-title-group">
            <MapPin size={18} className="icon-cyan" />
            <h2 id="zone-summary-title" className="card-title">DISASTER ZONE AGGREGATION SUMMARY</h2>
          </div>
          <span className="count-badge">{incidents.length} ZONES ACTIVE</span>
        </div>

        <p className="card-subtitle">
          Real-time incident concentration aggregated by reported landmark/zone. Priority reflects the most severe alert in each sector.
        </p>

        {incidents.length === 0 ? (
          <div className="empty-state">
            <Layers size={28} className="empty-icon" />
            <p>No active disaster zone reports ingested yet.</p>
            <span className="empty-hint">Use Gateway to sync mesh packets to HQ.</span>
          </div>
        ) : (
          <div className="zone-grid">
            {incidents.map((inc) => (
              <div key={inc.zone} className={`zone-card zone-prio-${inc.overallPriority.toLowerCase()}`}>
                <div className="zone-card-header">
                  <span className="zone-name">{inc.zone}</span>
                  <span className={`priority-tag priority-${inc.overallPriority.toLowerCase()}`}>
                    {inc.overallPriority}
                  </span>
                </div>

                <div className="zone-card-body">
                  <div className="zone-stat-row">
                    <span className="stat-label">REPORTS:</span>
                    <span className="stat-val"><strong>{inc.reports}</strong></span>
                  </div>
                  <div className="zone-stat-row">
                    <span className="stat-label">AFFECTED:</span>
                    <span className="stat-val"><strong>{inc.peopleAffected}</strong> people</span>
                  </div>
                  <div className="zone-stat-row">
                    <span className="stat-label">CRITICAL:</span>
                    <span className="stat-val text-alert"><strong>{inc.criticalReports}</strong> alerts</span>
                  </div>
                  <div className="zone-stat-row">
                    <span className="stat-label">LATEST:</span>
                    <span className="stat-val">{new Date(inc.latestTimestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="zone-card-footer">
                  <span className="zone-types-tag">
                    {inc.emergencyTypes.join(' • ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Mesh Hop Topology Graph */}
      <section className="terminal-card" aria-labelledby="topology-graph-title">
        <MeshTopologyVisualizer autoRefreshInterval={6000} />
      </section>

      {/* Section 3: Active Incident Reports & Triage Actions */}
      <section className="terminal-card" aria-labelledby="incident-triage-title">
        <div className="card-header">
          <div className="header-title-group">
            <AlertTriangle size={18} className="icon-cyan" />
            <h2 id="incident-triage-title" className="card-title">ACTIVE INCIDENT TRIAGE &amp; DISPATCH QUEUE</h2>
          </div>

          <div className="filter-controls">
            <Filter size={14} className="icon-dim" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="tactical-filter-select"
              aria-label="Filter by priority"
            >
              <option value="">ALL PRIORITIES</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="tactical-filter-select"
              aria-label="Filter by status"
            >
              <option value="">ALL STATUSES</option>
              <option value="SYNCED_TO_GATEWAY">SYNCED TO HQ</option>
              <option value="PROCESSED">PROCESSED</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>
        </div>

        <p className="card-subtitle">
          Ingested field messages sorted by priority and recency. Operators can review audit trails and assign response units.
        </p>

        <div className="messages-list">
          {messages.length === 0 ? (
            <div className="empty-state">
              <ShieldAlert size={32} className="empty-icon" />
              <p>No active incidents matching the selected filter criteria.</p>
              <span className="empty-hint">Sync messages from the Gateway Node to ingest incident packets.</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isBusy = actionInProgressId === msg.id;

              return (
                <article key={msg.id} className={`message-packet-card incident-card border-${msg.priority.toLowerCase()}`} data-id={msg.id}>
                  <div className="packet-header">
                    <div className="incident-id-group">
                      <span className="packet-id">{msg.id}</span>
                      <span className="emergency-type-tag">{msg.type}</span>
                    </div>

                    <div className="packet-tags-group">
                      <span className={`priority-tag priority-${msg.priority.toLowerCase()}`}>
                        {msg.priority}
                      </span>
                      <span className={`status-pill status-${msg.status.toLowerCase()}`}>
                        {msg.status}
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
                      <strong>{msg.location}</strong>
                    </span>
                    <span className="meta-item">
                      <Users size={12} />
                      <strong>{msg.peopleAffected}</strong> people affected
                    </span>
                    {msg.serverReceivedAt && (
                      <span className="meta-item text-dim">
                        Ingested: {new Date(msg.serverReceivedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  <p className="packet-body">{msg.message}</p>

                  {/* Audit Path */}
                  <div className="routing-chain-box">
                    <div className="chain-row">
                      <span className="chain-node origin-tag">ORIGIN: {msg.originNode}</span>
                      <ArrowRight size={12} className="chain-arrow" />
                      {msg.history && msg.history.length > 1 && (
                        <>
                          <span className="chain-node">
                            {msg.history.slice(0, -1).map((h) => h.node_id).join(' → ')}
                          </span>
                          <ArrowRight size={12} className="chain-arrow" />
                        </>
                      )}
                      <span className="chain-node current-tag">GATEWAY: {msg.currentNode}</span>
                      <ArrowRight size={12} className="chain-arrow" />
                      <span className="chain-node hq-tag">HQ INGESTED</span>
                    </div>
                    <div className="chain-stats">
                      <span>HOPS: <strong>{msg.hopCount}</strong></span>
                    </div>
                  </div>

                  {/* Operator Triage Actions */}
                  <div className="triage-action-bar">
                    <span className="triage-label">OPERATOR ACTION:</span>
                    <div className="triage-btn-group">
                      <button
                        type="button"
                        disabled={isBusy || msg.status === 'PROCESSED'}
                        onClick={() => handleStatusUpdate(msg.id, 'PROCESSED')}
                        className={`btn-triage btn-triage-process ${msg.status === 'PROCESSED' ? 'active' : ''}`}
                        title="Mark report as reviewed by dispatch"
                      >
                        <CheckCircle2 size={13} />
                        <span>PROCESSED</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || msg.status === 'DISPATCHED'}
                        onClick={() => handleStatusUpdate(msg.id, 'DISPATCHED')}
                        className={`btn-triage btn-triage-dispatch ${msg.status === 'DISPATCHED' ? 'active' : ''}`}
                        title="Dispatch field rescue or medical team"
                      >
                        <Truck size={13} />
                        <span>DISPATCHED</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || msg.status === 'RESOLVED'}
                        onClick={() => handleStatusUpdate(msg.id, 'RESOLVED')}
                        className={`btn-triage btn-triage-resolve ${msg.status === 'RESOLVED' ? 'active' : ''}`}
                        title="Mark incident as resolved"
                      >
                        <CheckCircle2 size={13} />
                        <span>RESOLVED</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
