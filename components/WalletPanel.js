import { useState, useEffect } from 'react';
import { detectWallets, connectWallet, WALLET_INFO } from '../lib/wallets-kit';

function shortAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function WalletPanel({ connectedWallets, onConnect, onDisconnect }) {
  const [availableWallets, setAvailableWallets] = useState([]);
  const [connecting, setConnecting] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    detectWallets().then(setAvailableWallets).catch(() => setAvailableWallets([]));
  }, []);

  const handleConnect = async (walletId) => {
    setConnecting(walletId);
    setError(null);
    try {
      const result = await connectWallet(walletId);
      onConnect(result);
    } catch (err) {
      let msg = err.message || 'Connection failed';

      // Classify error for UX display
      if (
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('not installed')
      ) {
        const info = WALLET_INFO[walletId];
        msg = `${info?.name || walletId} not found. Install it at ${info?.installUrl}.`;
      }

      setError(msg);
    } finally {
      setConnecting(null);
    }
  };

  const isConnected = (walletId) =>
    connectedWallets.some((w) => w.walletId === walletId);

  return (
    <div className="wallet-panel">
      <div className="wallet-panel-header">
        <h3>Wallets</h3>
        <span className="wallet-count">
          {connectedWallets.length} connected
        </span>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '8px 0 12px', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      <div className="wallet-list">
        {availableWallets.map((w) => {
          const connected = isConnected(w.id);
          const connEntry = connectedWallets.find((c) => c.walletId === w.id);

          return (
            <div key={w.id} className={`wallet-entry ${connected ? 'wallet-connected' : ''}`}>
              <div className="wallet-entry-left">
                <span className="wallet-icon">{w.icon}</span>
                <div>
                  <div className="wallet-entry-name">{w.name}</div>
                  {connected && connEntry && (
                    <div className="wallet-entry-addr">{shortAddr(connEntry.address)}</div>
                  )}
                  {!w.available && !connected && (
                    <div className="wallet-entry-hint">
                      <a href={w.installUrl} target="_blank" rel="noopener noreferrer">
                        Install →
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {connected ? (
                <button
                  className="wallet-disconnect-btn"
                  onClick={() => onDisconnect(w.id)}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="wallet-connect-btn-sm"
                  onClick={() => handleConnect(w.id)}
                  disabled={connecting === w.id}
                >
                  {connecting === w.id ? '...' : 'Connect'}
                </button>
              )}
            </div>
          );
        })}

        {availableWallets.length === 0 && (
          <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
            Loading wallets...
          </p>
        )}
      </div>

      {connectedWallets.length > 0 && (
        <div className="connected-wallets">
          <div className="connected-wallets-label">Active addresses</div>
          {connectedWallets.map((w) => (
            <div key={w.walletId} className="connected-addr-row">
              <span className="wallet-icon" style={{ fontSize: '0.9rem' }}>
                {WALLET_INFO[w.walletId]?.icon || '💼'}
              </span>
              <span className="connected-addr-text">{w.address}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
