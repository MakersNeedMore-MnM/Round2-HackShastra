import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface NetworkStatusProps {
  simulatedOffline: boolean;
  onToggleSimulatedOffline: (val: boolean) => void;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({
  simulatedOffline,
  onToggleSimulatedOffline,
}) => {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const effectiveOffline = !browserOnline || simulatedOffline;

  return (
    <div className="network-status-bar" id="network-status-panel">
      <div className="status-indicators">
        {/* Actual Hardware Network State */}
        <div className={`status-pill ${browserOnline ? 'pill-online' : 'pill-offline'}`}>
          {browserOnline ? (
            <>
              <Wifi size={14} className="icon-pulse" />
              <span>HARDWARE: ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff size={14} />
              <span>HARDWARE: OFFLINE</span>
            </>
          )}
        </div>

        {/* Effective App Mesh State */}
        <div className={`status-pill ${effectiveOffline ? 'pill-offline' : 'pill-online'}`}>
          {effectiveOffline ? (
            <>
              <AlertTriangle size={14} />
              <span>APP STATE: DISCONNECTED (OFFLINE STORE MODE)</span>
            </>
          ) : (
            <>
              <span className="live-dot"></span>
              <span>APP STATE: CONNECTED</span>
            </>
          )}
        </div>
      </div>

      {/* Demo / Testing Offline Simulation Toggle */}
      <div className="simulation-toggle-group">
        <label htmlFor="sim-offline-toggle" className="toggle-label">
          <span>Simulate Offline (Testing)</span>
          <input
            id="sim-offline-toggle"
            type="checkbox"
            checked={simulatedOffline}
            onChange={(e) => onToggleSimulatedOffline(e.target.checked)}
          />
          <span className="toggle-switch"></span>
        </label>
        {simulatedOffline && (
          <span className="sim-badge">FORCED OFFLINE ACTIVE</span>
        )}
      </div>
    </div>
  );
};
