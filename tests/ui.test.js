import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SwapForm from '../components/SwapForm';

jest.mock('../lib/stellar', () => ({
  findSwapPaths: jest.fn(),
  formatAmount: jest.fn((amount) => String(amount)),
  submitTransaction: jest.fn(),
  broadcastTransaction: jest.fn(),
  getPaymentHistory: jest.fn().mockResolvedValue([]),
  streamPayments: jest.fn().mockReturnValue(() => {}) // returns a close() function
}));

jest.mock('../lib/wallet', () => ({
  checkWalletConnection: jest.fn(),
  connectWallet: jest.fn(),
  signTransaction: jest.fn()
}));

const stellar = require('../lib/stellar');
const wallet = require('../lib/wallet');

// Valid Stellar address: starts with G, 56 chars total, only A-Z and 2-7
const TEST_ADDRESS = 'G' + 'A'.repeat(55);

// Helper: render and wait past the initializing spinner
async function renderAndInit() {
  render(<SwapForm />);
  // Wait until the spinner is gone and the form is visible
  await waitFor(() => {
    expect(screen.getByText('Find Best Rate')).toBeInTheDocument();
  });
}

describe('SwapForm UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wallet.checkWalletConnection.mockResolvedValue({ isConnected: false, publicKey: null });
    wallet.connectWallet.mockResolvedValue({ isConnected: true, publicKey: TEST_ADDRESS });
    wallet.signTransaction.mockResolvedValue('signedxdrbase64==');
    stellar.getPaymentHistory.mockResolvedValue([]);
    stellar.streamPayments.mockReturnValue(() => {});
    stellar.broadcastTransaction.mockResolvedValue({
      hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
      ledger: 12345,
      explorerUrl: 'https://stellar.expert/explorer/testnet/tx/abc123def456'
    });
    stellar.submitTransaction.mockResolvedValue({
      transaction: { toXDR: () => 'base64xdr' },
      networkPassphrase: 'Test SDF Network ; September 2015'
    });
  });

  test('should render swap form components', async () => {
    await renderAndInit();

    expect(screen.getByText('Token Swap')).toBeInTheDocument();
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText('Find Best Rate')).toBeInTheDocument();
  });

  test('should show loading state when button is clicked', async () => {
    stellar.findSwapPaths.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ paths: [] }), 100))
    );

    await renderAndInit();

    const inputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    fireEvent.click(screen.getByText('Find Best Rate'));

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  test('should show error for invalid amount', async () => {
    await renderAndInit();

    fireEvent.click(screen.getByText('Find Best Rate'));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid amount')).toBeInTheDocument();
    });
  });

  test('should show error when same asset selected', async () => {
    await renderAndInit();

    const selects = screen.getAllByRole('combobox');
    const xlmValue = JSON.stringify({ code: 'XLM', name: 'Stellar (XLM)' });
    fireEvent.change(selects[1], { target: { value: xlmValue } });

    const inputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    fireEvent.click(screen.getByText('Find Best Rate'));

    await waitFor(() => {
      expect(screen.getByText('Source and destination assets must be different')).toBeInTheDocument();
    });
  });

  test('should handle no liquidity case', async () => {
    stellar.findSwapPaths.mockResolvedValue({ paths: [] });

    await renderAndInit();

    const inputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    fireEvent.click(screen.getByText('Find Best Rate'));

    await waitFor(() => {
      expect(screen.getByText(/No liquidity found/i)).toBeInTheDocument();
    });
  });

  test('should show swap result when paths found', async () => {
    stellar.findSwapPaths.mockResolvedValue({
      paths: [{
        source_asset_type: 'native',
        source_asset_code: 'XLM',
        destination_asset_type: 'credit',
        destination_asset_code: 'USDC',
        destination_amount: '50.00',
        path: []
      }]
    });

    await renderAndInit();

    const inputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    fireEvent.click(screen.getByText('Find Best Rate'));

    await waitFor(() => {
      expect(screen.getByText(/Exchange Rate/i)).toBeInTheDocument();
    });
  });

  test('should clear result when amount changes', async () => {
    stellar.findSwapPaths.mockResolvedValue({
      paths: [{
        source_asset_type: 'native',
        destination_amount: '50.00',
        path: []
      }]
    });

    await renderAndInit();

    const inputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    fireEvent.click(screen.getByText('Find Best Rate'));

    await waitFor(() => {
      expect(screen.getByText(/Exchange Rate/i)).toBeInTheDocument();
    });

    fireEvent.change(inputs[0], { target: { value: '200' } });
    expect(screen.queryByText(/Exchange Rate/i)).not.toBeInTheDocument();
  });

  test('should show success popup after swap', async () => {
    stellar.findSwapPaths.mockResolvedValue({
      paths: [{
        source_asset_type: 'native',
        destination_amount: '50.00',
        path: []
      }]
    });

    await renderAndInit();

    const addressInput = screen.getByPlaceholderText('Enter Stellar address (G...)');
    fireEvent.change(addressInput, { target: { value: TEST_ADDRESS } });
    fireEvent.click(screen.getByText('Use This Address'));

    const inputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(inputs[0], { target: { value: '100' } });
    fireEvent.click(screen.getByText('Find Best Rate'));

    await waitFor(() => {
      expect(screen.getByText(/Exchange Rate/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Swap Now'));

    await waitFor(() => {
      expect(screen.getByText('Swap Successful!')).toBeInTheDocument();
    });

    expect(screen.getByText('View on Stellar Expert →')).toBeInTheDocument();
  });
});
