import * as StellarSDK from '@stellar/stellar-sdk';

export const CONTRACT_ID = 'CBDFIRAVWEWFGSV3ZSEEJNPNKT6TZGQ4PXIYDEQM626XNTF2STRCFIWO';
export const NETWORK_PASSPHRASE = StellarSDK.Networks.TESTNET;
export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// A known funded account used as the source for read-only simulations.
// Simulations never submit on-chain so the real sequence number doesn't matter.
const SIM_SOURCE = 'GCBPK5PGOK7QPJKFCZVMHPQTXDWGLQSY5JRCUECLCIKTRABINBAM7AKA';

function getRpcServer() {
  return new StellarSDK.SorobanRpc.Server(SOROBAN_RPC_URL);
}

function getHorizonServer() {
  return new StellarSDK.Horizon.Server(HORIZON_URL);
}

// Build a dummy Account for simulation — avoids an extra network round-trip
function simAccount() {
  return new StellarSDK.Account(SIM_SOURCE, '0');
}

// ── Read: get total payment count ─────────────────────────────────────────────
export async function getPaymentCount() {
  const server = getRpcServer();

  const contract = new StellarSDK.Contract(CONTRACT_ID);
  const tx = new StellarSDK.TransactionBuilder(simAccount(), {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_payment_count'))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (StellarSDK.SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(`Simulation failed: ${result.error}`);
  }

  const val = result.result?.retval;
  if (!val) return 0;
  return StellarSDK.scValToNative(val);
}

// ── Read: get user total sent (in stroops) ────────────────────────────────────
export async function getUserTotal(userAddress) {
  const server = getRpcServer();

  const contract = new StellarSDK.Contract(CONTRACT_ID);
  const tx = new StellarSDK.TransactionBuilder(simAccount(), {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'get_user_total',
        StellarSDK.nativeToScVal(userAddress, { type: 'address' })
      )
    )
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (StellarSDK.SorobanRpc.Api.isSimulationError(result)) {
    return 0n; // user not in storage yet
  }

  const val = result.result?.retval;
  if (!val) return 0n;
  const native = StellarSDK.scValToNative(val);
  return BigInt(native);
}

// ── Build record_payment transaction (for signing by wallet) ──────────────────
export async function buildRecordPaymentTx(fromAddress, amountStroops, memo) {
  const server = getRpcServer();
  const horizonServer = getHorizonServer();

  let account;
  try {
    account = await horizonServer.loadAccount(fromAddress);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error(
        'Account not found on testnet. Fund it at https://laboratory.stellar.org/#account-creator'
      );
    }
    throw new Error(`Failed to load account: ${err.message}`);
  }

  // Check sufficient balance
  const xlmBalance = account.balances.find(b => b.asset_type === 'native');
  if (!xlmBalance || parseFloat(xlmBalance.balance) < 1) {
    throw new Error(
      `Insufficient XLM balance. You need at least 1 XLM to pay transaction fees. ` +
      `Fund at https://laboratory.stellar.org/#account-creator`
    );
  }

  const contract = new StellarSDK.Contract(CONTRACT_ID);
  const memoSymbol = (memo || 'payment').substring(0, 9); // Symbol max 9 chars

  const tx = new StellarSDK.TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'record_payment',
        StellarSDK.nativeToScVal(fromAddress, { type: 'address' }),
        StellarSDK.nativeToScVal(amountStroops, { type: 'i128' }),
        StellarSDK.nativeToScVal(memoSymbol, { type: 'symbol' })
      )
    )
    .setTimeout(300)
    .build();

  // Simulate to get auth + footprint
  const simResult = await server.simulateTransaction(tx);
  if (StellarSDK.SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Contract simulation failed: ${simResult.error}`);
  }

  // Assemble the transaction with simulation data
  const prepared = StellarSDK.SorobanRpc.assembleTransaction(tx, simResult).build();
  return { transaction: prepared, networkPassphrase: NETWORK_PASSPHRASE };
}

// ── Submit a signed transaction and poll for result ───────────────────────────
export async function submitAndPoll(signedXdr, onStatusUpdate) {
  const server = getRpcServer();

  let tx;
  try {
    tx = StellarSDK.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  } catch (e) {
    throw new Error(`Invalid transaction XDR: ${e.message}`);
  }

  onStatusUpdate?.({ status: 'pending', message: 'Submitting transaction...' });

  let sendResult;
  try {
    sendResult = await server.sendTransaction(tx);
  } catch (err) {
    throw new Error(`Failed to submit: ${err.message}`);
  }

  if (sendResult.status === 'ERROR') {
    throw new Error(`Transaction error: ${sendResult.errorResult?.result()?.value()?.toString() || 'unknown error'}`);
  }

  const txHash = sendResult.hash;
  onStatusUpdate?.({ status: 'pending', message: 'Waiting for confirmation...', hash: txHash });

  // Poll up to 30 seconds
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));

    const poll = await server.getTransaction(txHash);

    if (poll.status === StellarSDK.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return {
        status: 'success',
        hash: txHash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
        returnValue: poll.returnValue ? StellarSDK.scValToNative(poll.returnValue) : null,
      };
    }

    if (poll.status === StellarSDK.SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain. Hash: ${txHash}`);
    }

    // NOT_FOUND = still processing
    onStatusUpdate?.({ status: 'pending', message: 'Confirming...', hash: txHash });
  }

  throw new Error(`Transaction timed out. Hash: ${txHash}`);
}
