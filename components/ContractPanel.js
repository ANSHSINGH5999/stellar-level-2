import { useState, useEffect, useCallback } from 'react';
import { getPaymentCount, getUserTotal, CONTRACT_ID } from '../lib/contract';

function stroop(n) {
  // Convert stroops to XLM string
  return (Number(BigInt(n ?? 0)) / 1e7).toFixed(7).replace(/\.?0+$/, '') || '0';
}

export default function ContractPanel({ walletAddress, refreshTrigger }) {
  const [count, setCount] = useState(null);
  const [userTotal, setUserTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, t] = await Promise.all([
        getPaymentCount(),
        walletAddress ? getUserTotal(walletAddress) : Promise.resolve(null),
      ]);
      setCount(c);
      setUserTotal(t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  return (
    <div className="contract-panel">
      <div className="contract-panel-header">
        <h3>Smart Contract State</h3>
        <button
          className="refresh-btn"
          onClick={load}
          disabled={loading}
          title="Refresh"
        >
          {loading ? '...' : '↻'}
        </button>
      </div>

      <div className="contract-id-row">
        <span className="contract-id-label">Contract</span>
        <a
          className="contract-id-val"
          href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {CONTRACT_ID.slice(0, 8)}...{CONTRACT_ID.slice(-6)}
        </a>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '8px 0', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      <div className="contract-stats">
        <div className="contract-stat">
          <div className="contract-stat-label">Total Payments Recorded</div>
          <div className="contract-stat-value">
            {count === null ? '—' : count}
          </div>
        </div>

        {walletAddress && (
          <div className="contract-stat">
            <div className="contract-stat-label">Your Total (XLM equivalent)</div>
            <div className="contract-stat-value">
              {userTotal === null ? '—' : `${stroop(userTotal)} XLM`}
            </div>
          </div>
        )}
      </div>

      <div className="contract-note">
        Data read live from testnet via Soroban RPC simulation
      </div>
    </div>
  );
}
