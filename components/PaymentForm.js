import { useState } from 'react';
import { buildRecordPaymentTx, submitAndPoll, NETWORK_PASSPHRASE } from '../lib/contract';
import { signTx } from '../lib/wallets-kit';
import TxStatusBadge from './TxStatusBadge';

function isValidStellarAddress(addr) {
  return typeof addr === 'string' && /^G[A-Z2-7]{55}$/.test(addr);
}

export default function PaymentForm({ connectedWallets, onSuccess }) {
  const [fromAddress, setFromAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [txState, setTxState] = useState({ status: 'idle' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const hasManyWallets = connectedWallets.length > 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setTxState({ status: 'idle' });

    // ── Validation ────────────────────────────────────────────────────────────
    const sender = hasManyWallets ? fromAddress : connectedWallets[0]?.address;
    if (!sender || !isValidStellarAddress(sender)) {
      setError('Please select a valid sender wallet address.');
      return;
    }

    const xlmAmount = parseFloat(amount);
    if (isNaN(xlmAmount) || xlmAmount <= 0) {
      setError('Please enter a positive payment amount.');
      return;
    }

    const amountStroops = BigInt(Math.round(xlmAmount * 1e7));
    if (amountStroops <= 0n) {
      setError('Amount is too small.');
      return;
    }

    setBusy(true);
    setTxState({ status: 'pending', message: 'Building transaction...' });

    try {
      // ── Build contract transaction ─────────────────────────────────────────
      const { transaction } = await buildRecordPaymentTx(
        sender,
        amountStroops,
        memo || 'payment'
      );

      setTxState({ status: 'pending', message: 'Waiting for wallet approval...' });

      // ── Sign with wallet ───────────────────────────────────────────────────
      let signedXdr;
      try {
        signedXdr = await signTx(transaction.toXDR(), NETWORK_PASSPHRASE);
      } catch (signErr) {
        const msg = signErr.message || '';
        if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not installed')) {
          throw new Error(
            'Wallet not found. Make sure your wallet extension is installed and the page is refreshed.'
          );
        }
        if (
          msg.toLowerCase().includes('rejected') ||
          msg.toLowerCase().includes('declined') ||
          msg.toLowerCase().includes('denied')
        ) {
          throw new Error('Transaction rejected. You declined the transaction in your wallet.');
        }
        throw signErr;
      }

      // ── Submit and poll ────────────────────────────────────────────────────
      const result = await submitAndPoll(signedXdr, (update) => {
        setTxState({ status: update.status, message: update.message, hash: update.hash });
      });

      setTxState({
        status: 'success',
        message: `Payment recorded on-chain! Count: ${result.returnValue ?? '?'}`,
        hash: result.hash,
      });

      setAmount('');
      setMemo('');
      onSuccess?.();

    } catch (err) {
      const msg = err.message || 'Transaction failed';

      // Classify errors for display
      let displayMsg = msg;
      if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('underfunded')) {
        displayMsg = `Insufficient balance: ${msg}`;
      } else if (msg.toLowerCase().includes('not found') && msg.toLowerCase().includes('wallet')) {
        displayMsg = `Wallet not found: ${msg}`;
      } else if (msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('declined')) {
        displayMsg = `Transaction rejected: ${msg}`;
      }

      setError(displayMsg);
      setTxState({ status: 'fail', message: displayMsg });
    } finally {
      setBusy(false);
    }
  };

  if (connectedWallets.length === 0) {
    return (
      <div className="payment-form-empty">
        Connect a wallet above to record payments to the smart contract.
      </div>
    );
  }

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <h3 className="payment-form-title">Record Payment to Contract</h3>

      {hasManyWallets && (
        <div className="form-group">
          <label>From Wallet</label>
          <select
            className="asset-select"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            disabled={busy}
            required
          >
            <option value="">Select wallet...</option>
            {connectedWallets.map((w) => (
              <option key={w.walletId} value={w.address}>
                {w.address.slice(0, 6)}...{w.address.slice(-4)} ({w.walletId})
              </option>
            ))}
          </select>
        </div>
      )}

      {!hasManyWallets && (
        <div className="form-group">
          <label>From</label>
          <div className="wallet-addr-display">
            {connectedWallets[0].address}
          </div>
        </div>
      )}

      <div className="form-group">
        <label>Amount (XLM equivalent)</label>
        <input
          type="number"
          className="amount-input"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
          min="0.0000001"
          step="any"
          required
        />
        <div style={{ color: '#666', fontSize: '0.75rem', marginTop: 4 }}>
          This amount is recorded on the smart contract (not actually sent)
        </div>
      </div>

      <div className="form-group">
        <label>Memo (optional, max 9 chars)</label>
        <input
          type="text"
          className="amount-input"
          style={{ fontSize: '1rem' }}
          placeholder="payment"
          value={memo}
          onChange={(e) => setMemo(e.target.value.slice(0, 9))}
          disabled={busy}
        />
      </div>

      {error && txState.status !== 'fail' && (
        <div className="error-message">{error}</div>
      )}

      <TxStatusBadge
        status={txState.status}
        message={txState.message}
        hash={txState.hash}
      />

      <button
        type="submit"
        className="submit-btn"
        disabled={busy}
      >
        {busy ? 'Processing...' : 'Record Payment on Contract'}
      </button>
    </form>
  );
}
