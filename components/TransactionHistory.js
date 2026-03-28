import { useState, useEffect, useRef } from 'react';
import { getPaymentHistory, streamPayments } from '../lib/stellar';

function formatAsset(op, side) {
  if (side === 'from') {
    if (op.source_asset_type === 'native' || op.asset_type === 'native') return 'XLM';
    return op.source_asset_code || op.asset_code || '?';
  }
  if (op.asset_type === 'native') return 'XLM';
  return op.asset_code || '?';
}

function formatAmt(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  // Show up to 6 decimals, strip trailing zeros
  return n.toFixed(6).replace(/\.?0+$/, '');
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function PaymentRow({ op, isNew }) {
  const isSwap =
    op.type === 'path_payment_strict_send' ||
    op.type === 'path_payment_strict_receive';

  const sentAmt = op.source_amount || op.amount || '0';
  const sentAsset = formatAsset(op, 'from');
  const recvAmt = op.amount || '0';
  const recvAsset = formatAsset(op, 'to');

  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${op.transaction_hash}`;

  return (
    <div className={`tx-row${isNew ? ' tx-row-new' : ''}`}>
      <div className="tx-badge">{isSwap ? 'Swap' : 'Payment'}</div>

      <div className="tx-flow">
        <span className="tx-sent">{formatAmt(sentAmt)} {sentAsset}</span>
        {isSwap && (
          <>
            <span className="tx-arrow">→</span>
            <span className="tx-recv">{formatAmt(recvAmt)} {recvAsset}</span>
          </>
        )}
      </div>

      <div className="tx-meta">
        <span className="tx-time">{formatTime(op.created_at)}</span>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-link"
        >
          View ↗
        </a>
      </div>
    </div>
  );
}

export default function TransactionHistory({ publicKey, refreshTrigger }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newIds, setNewIds] = useState(new Set());
  const closeStreamRef = useRef(null);
  const mountedRef = useRef(true);

  // Load history whenever publicKey or refreshTrigger changes
  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);

    getPaymentHistory(publicKey, 10)
      .then(records => {
        if (!mountedRef.current) return;
        setPayments(records);
        setLoading(false);
      })
      .catch(err => {
        if (!mountedRef.current) return;
        setError(err.message);
        setLoading(false);
      });
  }, [publicKey, refreshTrigger]);

  // Start SSE stream — runs once per publicKey, never causes a page refresh
  useEffect(() => {
    if (!publicKey) return;
    mountedRef.current = true;

    // Stop any existing stream before starting a new one
    if (closeStreamRef.current) {
      closeStreamRef.current();
      closeStreamRef.current = null;
    }

    const close = streamPayments(
      publicKey,
      (payment) => {
        if (!mountedRef.current) return;
        // Prepend to list without replacing anything
        setPayments(prev => [payment, ...prev.slice(0, 9)]);
        setNewIds(prev => {
          const next = new Set(prev);
          next.add(payment.id);
          // Remove "new" highlight after 3s
          setTimeout(() => {
            setNewIds(ids => {
              const s = new Set(ids);
              s.delete(payment.id);
              return s;
            });
          }, 3000);
          return next;
        });
      },
      (err) => {
        // Stream errors are non-fatal — history already loaded, just log
        console.warn('Payment stream error:', err);
      }
    );

    closeStreamRef.current = close;

    return () => {
      mountedRef.current = false;
      if (closeStreamRef.current) {
        closeStreamRef.current();
        closeStreamRef.current = null;
      }
    };
  }, [publicKey]);

  if (!publicKey) return null;

  return (
    <div className="history-container">
      <div className="history-header">
        <h3 className="history-title">Transaction History</h3>
        <span className="history-live">● Live</span>
      </div>

      {loading && (
        <div className="history-loading">
          <div className="init-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
        </div>
      )}

      {error && (
        <div className="error-message" style={{ margin: 0 }}>{error}</div>
      )}

      {!loading && !error && payments.length === 0 && (
        <div className="history-empty">No transactions yet.</div>
      )}

      {!loading && payments.map(op => (
        <PaymentRow
          key={op.id}
          op={op}
          isNew={newIds.has(op.id)}
        />
      ))}
    </div>
  );
}
