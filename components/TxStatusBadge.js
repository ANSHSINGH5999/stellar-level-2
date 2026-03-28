export default function TxStatusBadge({ status, message, hash }) {
  if (!status || status === 'idle') return null;

  const explorerUrl = hash
    ? `https://stellar.expert/explorer/testnet/tx/${hash}`
    : null;

  const config = {
    pending: {
      className: 'tx-status-pending',
      icon: '⏳',
      label: 'Pending',
    },
    success: {
      className: 'tx-status-success',
      icon: '✓',
      label: 'Confirmed',
    },
    fail: {
      className: 'tx-status-fail',
      icon: '✕',
      label: 'Failed',
    },
  }[status] || { className: '', icon: '?', label: status };

  return (
    <div className={`tx-status-box ${config.className}`}>
      <div className="tx-status-header">
        <span className="tx-status-icon">{config.icon}</span>
        <span className="tx-status-label">{config.label}</span>
        {status === 'pending' && <div className="tx-status-spinner" />}
      </div>

      {message && (
        <div className="tx-status-message">{message}</div>
      )}

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-status-link"
        >
          View on Stellar Expert →
        </a>
      )}
    </div>
  );
}
