import { useState, useEffect } from 'react';
import { SendSosPage } from './pages/SendSosPage';
import { RelayNodePage } from './pages/RelayNodePage';
import { GatewayPage } from './pages/GatewayPage';
import { CommandHqPage } from './pages/CommandHqPage';
import { Radio, ShieldAlert, Send, Layers, CloudUpload, Activity } from 'lucide-react';

type ViewMode = 'send' | 'node' | 'gateway' | 'command';

export function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('send');

  // Allow URL hash navigation (/send, /node, /gateway, /command)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#/node' || hash === '#node') {
        setCurrentView('node');
      } else if (hash === '#/send' || hash === '#send') {
        setCurrentView('send');
      } else if (hash === '#/gateway' || hash === '#gateway') {
        setCurrentView('gateway');
      } else if (hash === '#/command' || hash === '#command' || hash === '#/hq' || hash === '#hq') {
        setCurrentView('command');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view: ViewMode) => {
    setCurrentView(view);
    window.location.hash = `#/${view}`;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-section">
          <ShieldAlert size={22} className="icon-alert" />
          <span className="brand-title">MORROWMESH</span>
          <span className="brand-tagline">"When the network fails, the people become the network."</span>
        </div>

        <nav className="app-nav">
          <button
            type="button"
            className={`nav-btn ${currentView === 'send' ? 'nav-btn-active' : ''}`}
            onClick={() => navigateTo('send')}
            id="nav-send-btn"
          >
            <Send size={14} />
            <span>ORIGIN NODE (/send)</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${currentView === 'node' ? 'nav-btn-active' : ''}`}
            onClick={() => navigateTo('node')}
            id="nav-node-btn"
          >
            <Layers size={14} />
            <span>RELAY NODE (/node)</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${currentView === 'gateway' ? 'nav-btn-active' : ''}`}
            onClick={() => navigateTo('gateway')}
            id="nav-gateway-btn"
          >
            <CloudUpload size={14} />
            <span>GATEWAY (/gateway)</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${currentView === 'command' ? 'nav-btn-active' : ''}`}
            onClick={() => navigateTo('command')}
            id="nav-hq-btn"
          >
            <Activity size={14} />
            <span>COMMAND HQ (/command)</span>
          </button>
        </nav>

        <div className="brand-team">
          <Radio size={12} style={{ display: 'inline', marginRight: 4 }} />
          <span>TEAM HACKSHASTRA // RUDRA PRATAP SINGH</span>
        </div>
      </header>

      <main>
        {currentView === 'send' && <SendSosPage />}
        {currentView === 'node' && <RelayNodePage />}
        {currentView === 'gateway' && <GatewayPage onNavigateToHq={() => navigateTo('command')} />}
        {currentView === 'command' && <CommandHqPage onNavigateToGateway={() => navigateTo('gateway')} />}
      </main>
    </div>
  );
}

export default App;
