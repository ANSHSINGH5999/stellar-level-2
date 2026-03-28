import { useState, useEffect } from 'react';
import { findSwapPaths, formatAmount, submitTransaction, broadcastTransaction } from '../lib/stellar';
import { checkWalletConnection, connectWallet, signTransaction } from '../lib/wallet';
import TransactionHistory from './TransactionHistory';

const ASSETS = [
  { code: 'XLM', name: 'Stellar (XLM)' },
  { code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', name: 'USD Coin (USDC)' }
];

// Stellar public keys: 56 chars, start with G, base32 alphabet (A-Z, 2-7)
function isValidStellarAddress(address) {
  return typeof address === 'string' && /^G[A-Z2-7]{55}$/.test(address);
}

// Apply 0.5% slippage tolerance so minor price movements don't fail the tx
function applySlippage(amount, slippagePct = 0.5) {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return '0.0000000';
  return (num * (1 - slippagePct / 100)).toFixed(7);
}

export default function SwapForm() {
  const [initializing, setInitializing] = useState(true); // true until wallet check completes
  const [walletConnected, setWalletConnected] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [fromAsset, setFromAsset] = useState(ASSETS[0]);
  const [toAsset, setToAsset] = useState(ASSETS[1]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [noLiquidity, setNoLiquidity] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [txInfo, setTxInfo] = useState(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    checkWalletConnection().then(state => {
      if (cancelled) return;
      if (state.isConnected && state.publicKey) {
        setWalletConnected(true);
        setPublicKey(state.publicKey);
      }
      setInitializing(false);
    }).catch(() => {
      if (!cancelled) setInitializing(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleConnectWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      const state = await connectWallet();
      setWalletConnected(state.isConnected);
      setPublicKey(state.publicKey);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualConnect = () => {
    if (!isValidStellarAddress(manualAddress)) {
      setError('Invalid Stellar address. Must be 56 characters starting with G.');
      return;
    }
    setWalletConnected(true);
    setPublicKey(manualAddress);
    setError(null);
  };

  const handleSwapAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setResult(null);
    setNoLiquidity(false);
    setError(null);
  };

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    setResult(null);
    setNoLiquidity(false);
    setError(null);
  };

  const handleFromAssetChange = (e) => {
    setFromAsset(JSON.parse(e.target.value));
    setResult(null);
    setNoLiquidity(false);
    setError(null);
  };

  const handleToAssetChange = (e) => {
    setToAsset(JSON.parse(e.target.value));
    setResult(null);
    setNoLiquidity(false);
    setError(null);
  };

  const handleFindPaths = async () => {
    if (!amount || parseFloat(amount) <= 0 || isNaN(parseFloat(amount))) {
      setError('Please enter a valid amount');
      return;
    }
    if (fromAsset.code === toAsset.code) {
      setError('Source and destination assets must be different');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setNoLiquidity(false);

    try {
      const response = await findSwapPaths(
        fromAsset.code,
        fromAsset.issuer || undefined,
        toAsset.code,
        toAsset.issuer || undefined,
        amount
      );

      if (response.paths && response.paths.length > 0) {
        const bestPath = response.paths[0];
        setResult({
          sourceAmount: formatAmount(amount),
          destAmount: formatAmount(bestPath.destination_amount),
          rate: formatAmount(parseFloat(bestPath.destination_amount) / parseFloat(amount), 6),
          path: bestPath
        });
      } else {
        setNoLiquidity(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to find swap paths');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!walletConnected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }
    if (!result || !result.path) {
      setError('Please find swap paths first');
      return;
    }

    setTxLoading(true);
    setError(null);

    try {
      const destMinWithSlippage = applySlippage(result.destAmount);

      const txResult = await submitTransaction(
        result.path,
        publicKey,
        fromAsset,
        toAsset,
        amount,
        destMinWithSlippage
      );

      const signedXdr = await signTransaction(
        txResult.transaction.toXDR(),
        txResult.networkPassphrase
      );

      const broadcast = await broadcastTransaction(signedXdr);

      setTxInfo(broadcast);
      setResult(null);
      setAmount('');
      // Refresh history after successful swap (SSE handles real-time, this covers the just-completed tx)
      setHistoryRefresh(n => n + 1);
    } catch (err) {
      setError(err.message || 'Transaction failed');
    } finally {
      setTxLoading(false);
    }
  };

  const handleClosePopup = () => {
    setTxInfo(null);
  };

  const formatPublicKey = (key) => {
    if (!key) return '';
    return key.slice(0, 6) + '...' + key.slice(-4);
  };

  const formatHash = (hash) => {
    if (!hash) return '';
    return hash.slice(0, 8) + '...' + hash.slice(-8);
  };

  const isBusy = loading || txLoading;

  // Show spinner while checking wallet on first load — prevents hydration flash
  if (initializing) {
    return (
      <div className="swap-container">
        <h1 className="title">Token Swap</h1>
        <div className="swap-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="init-spinner" />
          <p style={{ color: '#a0a0a0', marginTop: 16, fontSize: '0.9rem' }}>Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="swap-container">
      <h1 className="title">Token Swap</h1>

      <div className="swap-card">
        {!walletConnected ? (
          <div className="wallet-connect-section">
            <button
              type="button"
              onClick={handleConnectWallet}
              className="wallet-btn"
              disabled={isBusy}
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>

            <div style={{ textAlign: 'center', margin: '12px 0', color: '#666', fontSize: 12 }}>
              OR Enter Address Manually
            </div>

            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="Enter Stellar address (G...)"
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                marginBottom: '8px'
              }}
            />

            <button
              type="button"
              onClick={handleManualConnect}
              className="submit-btn"
              style={{ marginTop: 0 }}
              disabled={isBusy}
            >
              Use This Address
            </button>
          </div>
        ) : (
          <div className="wallet-info">
            <span>Connected:</span>
            <span className="wallet-address">{formatPublicKey(publicKey)}</span>
          </div>
        )}

        <div className="form-group">
          <label>From</label>
          <select
            value={JSON.stringify(fromAsset)}
            onChange={handleFromAssetChange}
            className="asset-select"
            disabled={isBusy}
          >
            {ASSETS.map(asset => (
              <option key={asset.code} value={JSON.stringify(asset)}>
                {asset.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.00"
            className="amount-input"
            disabled={isBusy}
            min="0"
          />
        </div>

        <div className="swap-button-container">
          <button
            type="button"
            onClick={handleSwapAssets}
            className="swap-direction-btn"
            disabled={isBusy}
            title="Swap assets"
          >
            ⇅
          </button>
        </div>

        <div className="form-group">
          <label>To</label>
          <select
            value={JSON.stringify(toAsset)}
            onChange={handleToAssetChange}
            className="asset-select"
            disabled={isBusy}
          >
            {ASSETS.map(asset => (
              <option key={asset.code} value={JSON.stringify(asset)}>
                {asset.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={result ? result.destAmount : ''}
            placeholder="0.00"
            className="amount-input"
            readOnly
          />
        </div>

        <button
          type="button"
          onClick={handleFindPaths}
          className="submit-btn"
          disabled={isBusy}
        >
          {loading ? 'Loading...' : 'Find Best Rate'}
        </button>

        {error && <div className="error-message">{error}</div>}
        {noLiquidity && (
          <div className="no-liquidity-message">No liquidity found for this swap pair.</div>
        )}

        {result && (
          <div className="result-container">
            <div className="result-row">
              <span>Exchange Rate</span>
              <span>1 {fromAsset.code} = {result.rate} {toAsset.code}</span>
            </div>
            <div className="result-row">
              <span>You Send</span>
              <span>{result.sourceAmount} {fromAsset.code}</span>
            </div>
            <div className="result-row">
              <span>You Receive</span>
              <span>{result.destAmount} {toAsset.code}</span>
            </div>
            <div className="result-row">
              <span>Slippage Tolerance</span>
              <span>0.5%</span>
            </div>
            <button
              type="button"
              onClick={handleExecuteSwap}
              className="execute-btn"
              disabled={isBusy}
            >
              {txLoading ? 'Processing...' : 'Swap Now'}
            </button>
          </div>
        )}
      </div>

      {/* Transaction History — real-time via Horizon SSE, no polling */}
      {walletConnected && publicKey && (
        <TransactionHistory publicKey={publicKey} refreshTrigger={historyRefresh} />
      )}

      {/* Success Popup */}
      {txInfo && (
        <div className="popup-overlay" onClick={handleClosePopup}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <div className="popup-icon">✓</div>
            <h2 className="popup-title">Swap Successful!</h2>
            <p className="popup-subtitle">Your transaction has been confirmed on the Stellar network.</p>

            <div className="popup-detail">
              <span className="popup-label">Transaction Hash</span>
              <span className="popup-value popup-hash">{formatHash(txInfo.hash)}</span>
            </div>

            {txInfo.ledger && (
              <div className="popup-detail">
                <span className="popup-label">Ledger</span>
                <span className="popup-value">#{txInfo.ledger}</span>
              </div>
            )}

            <a
              href={txInfo.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="popup-explorer-btn"
            >
              View on Stellar Expert →
            </a>

            <button type="button" className="popup-close-btn" onClick={handleClosePopup}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
