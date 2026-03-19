import { FaRecycle } from 'react-icons/fa';

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <FaRecycle />
        </div>
        <div>
          <div className="header-title">Smart Waste Monitor</div>
          <div className="header-subtitle">AI-Powered Municipal Waste Management System</div>
        </div>
      </div>
      <div className="header-right">
        <div className="header-badge">
          <span className="pulse-dot"></span>
          System Online
        </div>
        <div className="header-team">⚡ Algorithmic Thunder Squad</div>
      </div>
    </header>
  );
}
