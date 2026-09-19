import React, { useEffect, useState } from 'react';
import { Network, RefreshCw, Layers, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import type { TopologyResponse, TopologyNode } from '../types/message';

interface MeshTopologyVisualizerProps {
  autoRefreshInterval?: number;
}

export const MeshTopologyVisualizer: React.FC<MeshTopologyVisualizerProps> = ({
  autoRefreshInterval = 5000,
}) => {
  const [topology, setTopology] = useState<TopologyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopology = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTopology();
      setTopology(data);
    } catch {
      setError('Could not connect to backend topology service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [autoRefreshInterval]);

  // Compute layered coordinates for SVG layout
  // Column 0: ORIGIN
  // Column 1: RELAY
  // Column 2: GATEWAY
  // Column 3: HQ
  const layoutNodes = (nodes: TopologyNode[]) => {
    const columns: Record<string, TopologyNode[]> = {
      ORIGIN: [],
      RELAY: [],
      GATEWAY: [],
      HQ: [],
    };

    nodes.forEach((n) => {
      const type = n.type in columns ? n.type : 'RELAY';
      columns[type].push(n);
    });

    const nodePositions: Record<string, { x: number; y: number }> = {};
    const colOrder = ['ORIGIN', 'RELAY', 'GATEWAY', 'HQ'];
    const width = 800;
    const height = 360;
    const colSpacing = width / (colOrder.length + 0.5);

    colOrder.forEach((colKey, colIdx) => {
      const colNodes = columns[colKey];
      const x = (colIdx + 0.6) * colSpacing;
      const rowSpacing = height / (colNodes.length + 1);

      colNodes.forEach((node, rowIdx) => {
        const y = (rowIdx + 1) * rowSpacing;
        nodePositions[node.id] = { x, y };
      });
    });

    return nodePositions;
  };

  const nodePositions = topology ? layoutNodes(topology.nodes) : {};

  return (
    <div className="topology-container">
      <div className="topology-header">
        <div className="topology-title-group">
          <Network size={16} className="icon-cyan" />
          <h3 className="topology-title">DERIVED MESH HOP TOPOLOGY</h3>
          <span className="topology-badge">AUDIT-CHAIN DERIVED</span>
        </div>

        <div className="topology-actions">
          <button
            type="button"
            onClick={fetchTopology}
            disabled={loading}
            className="btn-compact"
            title="Refresh Topology"
          >
            <RefreshCw size={12} className={loading ? 'spin-icon' : ''} />
            <span>{loading ? 'MAPPING...' : 'REFRESH'}</span>
          </button>
        </div>
      </div>

      <div className="topology-canvas-wrapper">
        {error ? (
          <div className="topology-empty">
            <p className="topology-hint text-warning">{error}</p>
          </div>
        ) : !topology || topology.nodes.length <= 1 ? (
          <div className="topology-empty">
            <Layers size={36} className="empty-icon" />
            <p>No mesh routing chains mapped yet.</p>
            <span className="topology-hint">
              Synchronize messages through the Gateway to map physical relay pathways from origin nodes to Command HQ.
            </span>
          </div>
        ) : (
          <svg
            className="topology-svg"
            viewBox="0 0 820 380"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="22"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#58a6ff" />
              </marker>
              <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#58a6ff" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Links */}
            {topology.links.map((link, idx) => {
              const srcPos = nodePositions[link.source];
              const tgtPos = nodePositions[link.target];
              if (!srcPos || !tgtPos) return null;

              const dx = tgtPos.x - srcPos.x;
              const cx1 = srcPos.x + dx * 0.4;
              const cy1 = srcPos.y;
              const cx2 = srcPos.x + dx * 0.6;
              const cy2 = tgtPos.y;
              const pathD = `M ${srcPos.x} ${srcPos.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgtPos.x} ${tgtPos.y}`;

              const midX = (srcPos.x + tgtPos.x) / 2;
              const midY = (srcPos.y + tgtPos.y) / 2;

              return (
                <g key={`link-${idx}`} className="topology-link-group">
                  <path
                    d={pathD}
                    className="topology-edge"
                    markerEnd="url(#arrowhead)"
                  />
                  {link.count > 1 && (
                    <text
                      x={midX}
                      y={midY - 8}
                      className="topology-link-weight"
                      textAnchor="middle"
                    >
                      ×{link.count}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {topology.nodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              let nodeColor = '#00f0ff';
              let badgeClass = 'node-relay';

              if (node.type === 'ORIGIN') {
                nodeColor = '#d29922';
                badgeClass = 'node-origin';
              } else if (node.type === 'GATEWAY') {
                nodeColor = '#3fb950';
                badgeClass = 'node-gateway';
              } else if (node.type === 'HQ') {
                nodeColor = '#ff2a4b';
                badgeClass = 'node-hq';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className={`topology-node-group ${badgeClass}`}
                >
                  <circle
                    r={18}
                    className="topology-node-circle"
                    style={{ stroke: nodeColor }}
                  />
                  <circle
                    r={6}
                    className="topology-node-inner"
                    style={{ fill: nodeColor }}
                  />
                  <text
                    y={32}
                    className="topology-node-label"
                    textAnchor="middle"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="topology-legend">
        <div className="legend-item">
          <span className="legend-dot dot-origin"></span>
          <span>ORIGIN NODE</span>
        </div>
        <ArrowRight size={10} className="legend-arrow" />
        <div className="legend-item">
          <span className="legend-dot dot-relay"></span>
          <span>RELAY NODE (P2P)</span>
        </div>
        <ArrowRight size={10} className="legend-arrow" />
        <div className="legend-item">
          <span className="legend-dot dot-gateway"></span>
          <span>GATEWAY NODE (UPLINK)</span>
        </div>
        <ArrowRight size={10} className="legend-arrow" />
        <div className="legend-item">
          <span className="legend-dot dot-hq"></span>
          <span>COMMAND HQ</span>
        </div>
      </div>
    </div>
  );
};
