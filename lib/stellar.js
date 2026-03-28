const StellarSDK = require('@stellar/stellar-sdk');
const { swapCache } = require('./cache');

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSDK.Networks.TESTNET;
const server = new StellarSDK.Horizon.Server(HORIZON_URL);

// Human-readable Stellar operation result codes
const OP_ERROR_MESSAGES = {
  op_no_source_account:   'Source account not found.',
  op_not_supported:       'Operation not supported.',
  op_too_many_subentries: 'Account has too many entries.',
  op_underfunded:         'Insufficient balance to complete the swap.',
  op_src_not_authorized:  'Source asset not authorized.',
  op_no_destination:      'Destination account does not exist.',
  op_no_trust:            'Missing USDC trustline. Add a USDC trustline to your account first.',
  op_line_full:           'USDC trustline is full — your USDC limit has been reached.',
  op_no_issuer:           'Asset issuer account not found.',
  op_too_few_offers:      'Not enough liquidity for this swap. Try a smaller amount.',
  op_cross_self:          'Cannot swap with yourself.',
  op_under_dest_min:      'Price moved too much. Please fetch a new rate and try again.',
  tx_bad_auth:            'Transaction signature is invalid.',
  tx_bad_seq:             'Transaction is out of date. Please try again.',
  tx_insufficient_fee:    'Transaction fee is too low.',
  tx_no_account:          'Account not found on testnet.',
};

function decodeResultCodes(resultCodes) {
  const codes = [];
  if (resultCodes.transaction) {
    const msg = OP_ERROR_MESSAGES[resultCodes.transaction];
    if (msg) codes.push(msg);
  }
  if (Array.isArray(resultCodes.operations)) {
    resultCodes.operations.forEach(op => {
      const msg = OP_ERROR_MESSAGES[op];
      if (msg && !codes.includes(msg)) codes.push(msg);
    });
  }
  return codes.length > 0
    ? codes.join(' ')
    : `Transaction failed: ${JSON.stringify(resultCodes)}`;
}

async function findSwapPaths(sourceAssetCode, sourceAssetIssuer, destAssetCode, destAssetIssuer, sourceAmount) {
  const cacheKey = swapCache.generateKey(
    `${sourceAssetCode}:${sourceAssetIssuer || 'native'}`,
    `${destAssetCode}:${destAssetIssuer || 'native'}`,
    sourceAmount
  );

  const cached = swapCache.get(cacheKey);
  if (cached) return cached;

  let sourceAsset, destAsset;

  if (sourceAssetCode === 'XLM' || !sourceAssetIssuer || sourceAssetIssuer === 'null' || sourceAssetIssuer === 'undefined') {
    sourceAsset = StellarSDK.Asset.native();
  } else {
    try { sourceAsset = new StellarSDK.Asset(sourceAssetCode, sourceAssetIssuer); }
    catch (e) { throw new Error('Invalid source asset: ' + e.message); }
  }

  if (destAssetCode === 'XLM' || !destAssetIssuer || destAssetIssuer === 'null' || destAssetIssuer === 'undefined') {
    destAsset = StellarSDK.Asset.native();
  } else {
    try { destAsset = new StellarSDK.Asset(destAssetCode, destAssetIssuer); }
    catch (e) { throw new Error('Invalid destination asset: ' + e.message); }
  }

  try {
    const paths = await server.strictSendPaths(sourceAsset, sourceAmount, [destAsset]).call();
    const result = { paths: paths.records || [], timestamp: Date.now() };
    swapCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return { paths: [], timestamp: Date.now() };
    }
    throw new Error(`Failed to find swap paths: ${error.message}`);
  }
}

async function submitTransaction(path, publicKey, fromAsset, toAsset, sourceAmount, destMin) {
  let account;
  try {
    account = await server.loadAccount(publicKey);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new Error(
        'Account not found on testnet. Fund your account at https://laboratory.stellar.org/#account-creator'
      );
    }
    throw new Error(`Failed to load account: ${error.message}`);
  }

  // Check sufficient XLM above minimum reserve
  const xlmBalance = account.balances.find(b => b.asset_type === 'native');
  if (xlmBalance) {
    // Each trustline costs 0.5 XLM reserve; base is 1 XLM
    const numTrustlines = account.balances.filter(b => b.asset_type !== 'native').length;
    const minReserve = (2 + numTrustlines) * 0.5;
    const available = parseFloat(xlmBalance.balance) - minReserve;
    if (fromAsset.code === 'XLM' && available < parseFloat(sourceAmount)) {
      throw new Error(
        `Insufficient XLM. Available: ${available.toFixed(7)} XLM (${minReserve} XLM reserved for account minimum).`
      );
    }
  }

  // Check destination asset trustline
  if (toAsset.code !== 'XLM' && toAsset.issuer) {
    const hasTrustline = account.balances.some(
      b => b.asset_code === toAsset.code && b.asset_issuer === toAsset.issuer
    );
    if (!hasTrustline) {
      throw new Error(
        `No ${toAsset.code} trustline on your account. ` +
        `Add one at https://laboratory.stellar.org before swapping.`
      );
    }
  }

  try {
    const sourceAssetObj = fromAsset.issuer
      ? new StellarSDK.Asset(fromAsset.code, fromAsset.issuer)
      : StellarSDK.Asset.native();

    const destAssetObj = toAsset.issuer
      ? new StellarSDK.Asset(toAsset.code, toAsset.issuer)
      : StellarSDK.Asset.native();

    // Map intermediate path assets from Horizon path response
    const intermediatePath = (path.path || []).map(p => {
      if (p.asset_type === 'native') return StellarSDK.Asset.native();
      return new StellarSDK.Asset(p.asset_code, p.asset_issuer);
    });

    // Use exact 7-decimal format for both send amount and destMin
    const sendAmountFormatted = parseFloat(sourceAmount).toFixed(7);
    const destMinFormatted = parseFloat(destMin).toFixed(7);

    const transaction = new StellarSDK.TransactionBuilder(account, {
      fee: '1000',
      networkPassphrase: NETWORK_PASSPHRASE
    })
      .addOperation(StellarSDK.Operation.pathPaymentStrictSend({
        sendAsset: sourceAssetObj,
        sendAmount: sendAmountFormatted,
        destination: publicKey,
        destAsset: destAssetObj,
        destMin: destMinFormatted,
        path: intermediatePath
      }))
      .setTimeout(300)
      .build();

    return { transaction, networkPassphrase: NETWORK_PASSPHRASE };
  } catch (error) {
    throw new Error(`Failed to build transaction: ${error.message}`);
  }
}

async function broadcastTransaction(signedXdr) {
  try {
    const tx = StellarSDK.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const response = await server.submitTransaction(tx);
    return {
      hash: response.hash,
      ledger: response.ledger,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${response.hash}`
    };
  } catch (error) {
    const extras = error.response && error.response.data && error.response.data.extras;
    if (extras && extras.result_codes) {
      throw new Error(decodeResultCodes(extras.result_codes));
    }
    throw new Error(`Broadcast failed: ${error.message}`);
  }
}

// Load recent payment history for an account
async function getPaymentHistory(publicKey, limit = 10) {
  try {
    const result = await server
      .payments()
      .forAccount(publicKey)
      .order('desc')
      .limit(limit)
      .call();

    return (result.records || []).filter(op =>
      op.type === 'path_payment_strict_send' ||
      op.type === 'path_payment_strict_receive' ||
      op.type === 'payment'
    );
  } catch (error) {
    if (error.response && error.response.status === 404) return [];
    throw new Error(`Failed to load history: ${error.message}`);
  }
}

// Stream new payments in real-time using Horizon SSE — no polling, no refresh
// Returns a close() function to stop streaming
function streamPayments(publicKey, onPayment, onError) {
  const closeStream = server
    .payments()
    .forAccount(publicKey)
    .cursor('now')
    .stream({
      onmessage: (payment) => {
        if (
          payment.type === 'path_payment_strict_send' ||
          payment.type === 'path_payment_strict_receive' ||
          payment.type === 'payment'
        ) {
          onPayment(payment);
        }
      },
      onerror: (error) => {
        if (onError) onError(error);
      }
    });
  return closeStream;
}

function formatAmount(amount, decimals = 7) {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0.0000000';
  return num.toFixed(decimals);
}

// Set the home domain on an issuing account so it links to your stellar.toml
// secretKey: the issuing account's secret key
// homeDomain: the domain hosting your stellar.toml (e.g. "yourdomain.com")
async function setHomeDomain(secretKey, homeDomain) {
  const issuingKeys = StellarSDK.Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(issuingKeys.publicKey());

  const transaction = new StellarSDK.TransactionBuilder(account, {
    fee: '1000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSDK.Operation.setOptions({ homeDomain }))
    .setTimeout(100)
    .build();

  transaction.sign(issuingKeys);
  const response = await server.submitTransaction(transaction);
  return { hash: response.hash, homeDomain };
}

module.exports = {
  findSwapPaths,
  submitTransaction,
  broadcastTransaction,
  getPaymentHistory,
  streamPayments,
  formatAmount,
  setHomeDomain,
  server,
  HORIZON_URL,
  NETWORK_PASSPHRASE
};
