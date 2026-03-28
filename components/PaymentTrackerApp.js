import { useState, useCallback } from 'react';
import WalletPanel from './WalletPanel';
import PaymentForm from './PaymentForm';
import ContractPanel from './ContractPanel';
import TransactionHistory from './TransactionHistory';

export default function PaymentTrackerApp() {
  const [connectedWallets, setConnectedWallets] = useState([]);
  const [contractRefresh, setContractRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const handleConnect = useCallback((wallet) => {
    setConnectedWallets((prev) => {
      // Avoid duplicates by walletId
      const without = prev.filter((w) => w.walletId !== wallet.walletId);
      return [...without, wallet];
    });
  }, []);

  const handleDisconnect = useCallback((walletId) => {
    setConnectedWallets((prev) => prev.filter((w) => w.walletId !== walletId));
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    setContractRefresh((n) => n + 1);
    setHistoryRefresh((n) => n + 1);
  }, []);

  // Primary wallet address for contract reads / history
  const primaryAddress = connectedWallets[0]?.address || null;

  return (
    <div className="tracker-layout">
      <header className="tracker-header">
        <h1 className="tracker-title">Payment Tracker</h1>
        <p className="tracker-subtitle">
          Multi-wallet · Stellar Testnet · Soroban Smart Contract
        </p>
      </header>

      <div className="tracker-grid">
        {/* Left column */}
        <div className="tracker-col">
          <WalletPanel
            connectedWallets={connectedWallets}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />

          <ContractPanel
            walletAddress={primaryAddress}
            refreshTrigger={contractRefresh}
          />
        </div>

        {/* Right column */}
        <div className="tracker-col">
          <div className="swap-card">
            <PaymentForm
              connectedWallets={connectedWallets}
              onSuccess={handlePaymentSuccess}
            />
          </div>

          {primaryAddress && (
            <TransactionHistory
              publicKey={primaryAddress}
              refreshTrigger={historyRefresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}
