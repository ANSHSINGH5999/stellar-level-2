import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FREIGHTER_ID, FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { LOBSTR_ID, LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import { XBULL_ID, xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';

export { FREIGHTER_ID, LOBSTR_ID, XBULL_ID };

export const WALLET_INFO = {
  [FREIGHTER_ID]: {
    name: 'Freighter',
    icon: '🔑',
    installUrl: 'https://freighter.app',
  },
  [LOBSTR_ID]: {
    name: 'Lobstr',
    icon: '🦞',
    installUrl: 'https://lobstr.co/universal-login',
  },
  [XBULL_ID]: {
    name: 'xBull',
    icon: '🐂',
    installUrl: 'https://xbull.app',
  },
};

let initialized = false;

function ensureInit() {
  if (initialized) return;
  StellarWalletsKit.init({
    network: Networks.TESTNET,
    selectedWalletId: FREIGHTER_ID,
    modules: [
      new FreighterModule(),
      new LobstrModule(),
      new xBullModule(),
    ],
  });
  initialized = true;
}

// ── Detect which wallets are available in this browser ────────────────────────
export async function detectWallets() {
  ensureInit();
  try {
    const results = await StellarWalletsKit.refreshSupportedWallets();
    return results.map((w) => ({
      id: w.id,
      name: WALLET_INFO[w.id]?.name || w.name,
      icon: WALLET_INFO[w.id]?.icon || '💼',
      available: w.isAvailable,
      installUrl: WALLET_INFO[w.id]?.installUrl || w.url || '',
    }));
  } catch {
    // Fallback: return all three as potentially unavailable
    return [FREIGHTER_ID, LOBSTR_ID, XBULL_ID].map((id) => ({
      id,
      name: WALLET_INFO[id].name,
      icon: WALLET_INFO[id].icon,
      available: false,
      installUrl: WALLET_INFO[id].installUrl,
    }));
  }
}

// ── Connect a specific wallet by ID ──────────────────────────────────────────
export async function connectWallet(walletId) {
  ensureInit();

  try {
    StellarWalletsKit.setWallet(walletId);
  } catch (err) {
    throw new Error(
      `${WALLET_INFO[walletId]?.name || walletId} wallet not found. ` +
      `Install it at ${WALLET_INFO[walletId]?.installUrl} and refresh.`
    );
  }

  let address;
  try {
    const result = await StellarWalletsKit.selectedModule.getAddress();
    address = result.address;
  } catch (err) {
    const code = err?.code;
    const msg = (err?.message || err?.toString() || '').toLowerCase();

    // Wallet extension not installed
    if (
      code === -2 ||
      msg.includes('not found') ||
      msg.includes('not installed') ||
      msg.includes('is not available') ||
      msg.includes('extension not detected')
    ) {
      const info = WALLET_INFO[walletId];
      throw new Error(
        `${info?.name || walletId} wallet not found. ` +
        `Install it at ${info?.installUrl} and refresh.`
      );
    }

    // User rejected
    if (
      code === -4 ||
      msg.includes('user declined') ||
      msg.includes('rejected') ||
      msg.includes('denied') ||
      msg.includes('cancelled') ||
      msg.includes('user cancel')
    ) {
      throw new Error(
        `${WALLET_INFO[walletId]?.name || walletId}: Connection rejected by user.`
      );
    }

    throw new Error(err?.message || `Failed to connect ${WALLET_INFO[walletId]?.name}`);
  }

  if (!address) {
    const info = WALLET_INFO[walletId];
    throw new Error(
      `${info?.name || walletId} wallet not found or not installed. ` +
      `Install it at ${info?.installUrl} and refresh.`
    );
  }

  return { walletId, address };
}

// ── Sign a transaction with the given wallet ──────────────────────────────────
export async function signTx(walletId, xdr, networkPassphrase) {
  ensureInit();

  try {
    StellarWalletsKit.setWallet(walletId);
  } catch {
    throw new Error(
      `Wallet not found. Make sure ${WALLET_INFO[walletId]?.name || walletId} is installed.`
    );
  }

  try {
    const result = await StellarWalletsKit.signTransaction(xdr, { networkPassphrase });
    const signed = result?.signedTxXdr;
    if (!signed) {
      throw new Error('No signed transaction returned — did you approve in your wallet?');
    }
    return signed;
  } catch (err) {
    const code = err?.code;
    const msg = (err?.message || err?.toString() || '').toLowerCase();

    // Wallet not installed
    if (
      code === -2 ||
      msg.includes('not found') ||
      msg.includes('not installed') ||
      msg.includes('extension not detected')
    ) {
      throw new Error(
        'Wallet not found. Please install your wallet extension and refresh the page.'
      );
    }

    // User rejected
    if (
      code === -4 ||
      msg.includes('user declined') ||
      msg.includes('rejected') ||
      msg.includes('denied') ||
      msg.includes('cancelled') ||
      msg.includes('user cancel')
    ) {
      throw new Error('Transaction rejected. You declined the transaction in your wallet.');
    }

    throw new Error(err?.message || 'Failed to sign transaction');
  }
}
