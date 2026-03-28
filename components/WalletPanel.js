import { useState, useEffect } from 'react';
import { detectWallets, connectWallet, FREIGHTER_ID, WALLET_INFO } from '../lib/wallets-kit';

function shortAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 8) + '...' + addr.slice(-6);
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function WalletPanel({ connectedWallets, onConnect, onDisconnect }) {
  const [wallets, setWallets] = useState([]);
  const [connecting, setConnecting] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    detectWallets().then(setWallets).catch(() => setWallets([]));
  }, []);

  const isConnected = (id) => connectedWallets.some(w => w.walletId === id);
  const getEntry = (id) => connectedWallets.find(w => w.walletId === id);

  const handleConnect = async (walletId) => {
    setConnecting(walletId);
    setError(null);
    try {
      const result = await connectWallet(walletId);
      onConnect(result);
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setConnecting(null);
    }
  };

  const handleCopy = (address, id) => {
    navigator.clipboard?.writeText(address).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  return (
    <div className="wallet-panel">
      {/* Header */}
      <div className="wp-header">
        <div className="wp-title-row">
          <span className="wp-title">Wallets</span>
          {connectedWallets.length > 0 && (
            <span className="wp-connected-badge">
              <span className="wp-status-dot" /> {connectedWallets.length} connected
            </span>
          )}
        </div>
        <p className="wp-subtitle">Connect your Stellar wallet to get started</p>
      </div>

      {/* Error */}
      {error && (
        <div className="wp-error">
          <span>⚠</span> {error}
        </div>
      )}

      {/* Wallet cards */}
      <div className="wp-wallets">
        {wallets.map(w => {
          const connected = isConnected(w.id);
          const entry = getEntry(w.id);
          const isFreighter = w.id === FREIGHTER_ID;
          const busy = connecting === w.id;

          return (
            <div
              key={w.id}
              className={`wp-card ${isFreighter ? 'wp-card-primary' : 'wp-card-secondary'} ${connected ? 'wp-card-connected' : ''}`}
            >
              {/* Card header */}
              <div className="wp-card-header">
                <div className="wp-card-identity">
                  <span className="wp-card-icon">{w.icon}</span>
                  <div>
                    <div className="wp-card-name">{w.name}</div>
                    <div className="wp-card-tagline">{w.tagline}</div>
                  </div>
                </div>

                {connected && (
                  <span className="wp-active-tag">
                    <span className="wp-active-dot" /> Active
                  </span>
                )}
              </div>

              {/* Connected state */}
              {connected && entry ? (
                <div className="wp-connected-row">
                  <div className="wp-addr-pill">
                    <span className="wp-addr-text">{shortAddr(entry.address)}</span>
                    <button
                      className="wp-copy-btn"
                      onClick={() => handleCopy(entry.address, w.id)}
                      title="Copy address"
                    >
                      {copied === w.id ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  </div>
                  <button
                    className="wp-disconnect-btn"
                    onClick={() => onDisconnect(w.id)}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                /* Connect button */
                w.available ? (
                  <button
                    className={`wp-connect-btn ${isFreighter ? 'wp-connect-primary' : 'wp-connect-secondary'}`}
                    onClick={() => handleConnect(w.id)}
                    disabled={busy}
                  >
                    {busy ? (
                      <><span className="wp-btn-spinner" /> Connecting…</>
                    ) : (
                      <>{isFreighter ? '⚡' : '🔗'} Connect {w.name}</>
                    )}
                  </button>
                ) : (
                  <a
                    href={w.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wp-install-btn"
                  >
                    ↗ Install {w.name}
                  </a>
                )
              )}
            </div>
          );
        })}

        {wallets.length === 0 && (
          <div className="wp-loading">
            <div className="wp-spinner" />
            <span>Detecting wallets…</span>
          </div>
        )}
      </div>

      {/* All addresses (multi-wallet mode) */}
      {connectedWallets.length > 1 && (
        <div className="wp-all-addrs">
          <div className="wp-all-label">All Connected Addresses</div>
          {connectedWallets.map(w => (
            <div key={w.walletId} className="wp-addr-line">
              <span className="wp-addr-icon">{WALLET_INFO[w.walletId]?.icon}</span>
              <span className="wp-addr-full">{w.address}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
