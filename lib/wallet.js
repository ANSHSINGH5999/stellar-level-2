import freighterApi from '@stellar/freighter-api';

const REQUIRED_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

let walletState = {
  isConnected: false,
  publicKey: null
};

async function checkFreighterInstalled() {
  try {
    const result = await freighterApi.isConnected();
    return result.isConnected === true;
  } catch {
    return false;
  }
}

async function checkNetwork() {
  try {
    // getNetwork() is lighter than getNetworkDetails() — returns only
    // {network, networkPassphrase, error} without requesting sorobanRpcUrl
    const details = await freighterApi.getNetwork();
    const passphrase = details.networkPassphrase;
    if (passphrase && passphrase !== REQUIRED_NETWORK_PASSPHRASE) {
      throw new Error(
        'Wrong network in Freighter. Please switch to Testnet:\n' +
        'Open Freighter → Settings → Network → Testnet'
      );
    }
  } catch (e) {
    if (e.message.includes('Wrong network')) throw e;
    // getNetwork unavailable — skip check
  }
}

// Wake up the Freighter service worker before calling it
async function wakeFreighter() {
  try {
    await freighterApi.isConnected();
  } catch {
    // ignore — just trying to wake the service worker
  }
}

export async function checkWalletConnection() {
  try {
    const installed = await checkFreighterInstalled();
    if (!installed) return { isConnected: false, publicKey: null };

    const allowed = await freighterApi.isAllowed();
    if (!allowed.isAllowed) return { isConnected: false, publicKey: null };

    const addressResult = await freighterApi.getAddress();
    if (addressResult.error || !addressResult.address) {
      return { isConnected: false, publicKey: null };
    }

    walletState = { isConnected: true, publicKey: addressResult.address };
    return walletState;
  } catch {
    return { isConnected: false, publicKey: null };
  }
}

export async function connectWallet() {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw new Error(
      'Freighter wallet not found. Install it at https://freighter.app then refresh.'
    );
  }

  await checkNetwork();

  const result = await freighterApi.requestAccess();
  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.address) {
    throw new Error('No address returned from Freighter');
  }

  walletState = { isConnected: true, publicKey: result.address };
  return walletState;
}

export async function signTransaction(txXdr, networkPassphrase) {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw new Error('Freighter not connected');
  }

  // Wake the service worker first — browsers suspend extensions after idle time,
  // which causes "Contract call failed" on the first message attempt
  await wakeFreighter();

  // Retry once after a short delay — service worker may need time to restart
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    const result = await freighterApi.signTransaction(txXdr, { networkPassphrase });

    if (!result.error) {
      if (!result.signedTxXdr) {
        throw new Error('No signed transaction returned — did you approve in Freighter?');
      }
      return result.signedTxXdr;
    }

    if (result.error === 'Contract call failed' && attempt === 0) {
      // Service worker was suspended — wake it and retry
      await wakeFreighter();
      continue;
    }

    // Translate known Freighter errors into readable messages
    if (result.error === 'Contract call failed') {
      throw new Error(
        'Freighter is not responding. Click the Freighter icon in your browser toolbar to open it, then try again.'
      );
    }
    if (result.error.toLowerCase().includes('user declined') ||
        result.error.toLowerCase().includes('rejected')) {
      throw new Error('Transaction rejected in Freighter.');
    }
    throw new Error(result.error);
  }
}

export function getWalletState() {
  return walletState;
}
