import { StellarWalletsKit, WalletNetwork } from '@creit.tech/stellar-wallets-kit';
import { FREIGHTER_ID, FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { LOBSTR_ID, LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import { XBULL_ID, xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';

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

let kitInstance = null;

export function getKit() {
  if (!kitInstance) {
    kitInstance = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: [
        new FreighterModule(),
        new LobstrModule(),
        new xBullModule(),
      ],
    });
  }
  return kitInstance;
}

// ── Connect a specific wallet by ID ──────────────────────────────────────────
export async function connectWallet(walletId) {
  const kit = getKit();
  kit.setWallet(walletId);

  let address;
  try {
    const result = await kit.getAddress();
    address = result.address;
  } catch (err) {
    // If not yet connected, request access
    if (
      err?.message?.toLowerCase().includes('not connected') ||
      err?.message?.toLowerCase().includes('not allowed') ||
      err?.message?.toLowerCase().includes('no address') ||
      err?.message?.toLowerCase().includes('user declined')
    ) {
      throw new Error(`${WALLET_INFO[walletId]?.name || walletId}: Connection rejected by user.`);
    }
    // Wallet extension not found
    if (
      err?.message?.toLowerCase().includes('not found') ||
      err?.message?.toLowerCase().includes('not installed') ||
      err?.message?.toLowerCase().includes('is not available')
    ) {
      const info = WALLET_INFO[walletId];
      throw new Error(
        `${info?.name || walletId} wallet not found. ` +
        `Install it at ${info?.installUrl || 'your browser extension store'} and refresh.`
      );
    }
    throw new Error(err?.message || `Failed to connect ${WALLET_INFO[walletId]?.name}`);
  }

  if (!address) {
    const info = WALLET_INFO[walletId];
    throw new Error(
      `${info?.name || walletId} wallet not found or not installed. ` +
      `Install it at ${info?.installUrl || 'your browser extension store'} and refresh.`
    );
  }

  return { walletId, address };
}

// ── Sign a transaction XDR with the active wallet ─────────────────────────────
export async function signTx(xdr, networkPassphrase) {
  const kit = getKit();

  try {
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase,
    });
    if (!signedTxXdr) {
      throw new Error('No signed transaction returned — did you approve in your wallet?');
    }
    return signedTxXdr;
  } catch (err) {
    const msg = err?.message || '';

    // Wallet not installed / not found
    if (
      msg.toLowerCase().includes('not found') ||
      msg.toLowerCase().includes('not installed') ||
      msg.toLowerCase().includes('is not available')
    ) {
      throw new Error(
        'Wallet not found. Please install your wallet extension and refresh the page.'
      );
    }

    // User rejected
    if (
      msg.toLowerCase().includes('user declined') ||
      msg.toLowerCase().includes('rejected') ||
      msg.toLowerCase().includes('denied') ||
      msg.toLowerCase().includes('cancelled') ||
      msg.toLowerCase().includes('user cancel')
    ) {
      throw new Error('Transaction rejected. You declined the transaction in your wallet.');
    }

    throw new Error(msg || 'Failed to sign transaction');
  }
}

// ── Check which wallets are available in this browser ─────────────────────────
export async function detectWallets() {
  const kit = getKit();
  const modules = kit.getSupportedWallets();
  const results = [];

  for (const mod of modules) {
    const info = WALLET_INFO[mod.id] || { name: mod.id, icon: '💼', installUrl: '' };
    try {
      const isAvailable = await mod.isAvailable();
      results.push({
        id: mod.id,
        name: info.name,
        icon: info.icon,
        available: isAvailable,
        installUrl: info.installUrl,
      });
    } catch {
      results.push({
        id: mod.id,
        name: info.name,
        icon: info.icon,
        available: false,
        installUrl: info.installUrl,
      });
    }
  }

  return results;
}
