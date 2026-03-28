# Stellar Token Swap dApp

A mini decentralized application (dApp) for swapping tokens on the Stellar blockchain. Built with Next.js and Stellar SDK.

## Features

- **Token Swap Interface**: Swap between XLM and USDC (or any Stellar asset)
- **Path Finding**: Uses Stellar Horizon API with `strictSendPaths` for optimal swap routes
- **In-Memory Caching**: Reduces repeated API calls with simple caching system
- **Loading States**: Clear feedback during async operations
- **Error Handling**: User-friendly error messages
- **No Liquidity Handling**: Informative message when no liquidity is found

## Project Structure

```
stellar-swap-dapp/
├── components/          # React UI components
│   └── SwapForm.js     # Main swap interface component
├── lib/                # Core logic
│   ├── cache.js        # In-memory caching system
│   └── stellar.js      # Stellar SDK integration
├── pages/              # Next.js pages
│   ├── _app.js         # App entry point
│   └── index.js        # Main page
├── styles/             # CSS styles
│   └── globals.css     # Global styles with dark theme
├── tests/              # Jest test files
│   ├── cache.test.js   # Cache module tests
│   ├── stellar.test.js # Stellar module tests
│   └── ui.test.js      # UI component tests
├── package.json        # Dependencies
├── next.config.js      # Next.js configuration
├── jest.config.js      # Jest configuration
└── README.md           # This file
```

## Architecture

### Layer 1: UI Layer (components/)
- `SwapForm.js` - Main component handling user input and displaying results

### Layer 2: Business Logic (lib/)
- `stellar.js` - Handles Stellar Horizon API calls, path finding, and transaction building
- `cache.js` - Simple in-memory cache with TTL support

### Layer 3: Pages (pages/)
- Next.js page routing and app initialization

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
cd stellar-swap-dapp

# Install dependencies
npm install
```

### Development

```bash
# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

```bash
# Create production build
npm run build

# Start production server
npm run start
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch
```

### Test Coverage

- **Cache Module Tests**: Tests for cache get/set/clear operations
- **Stellar Module Tests**: Tests for formatAmount and asset handling
- **UI Tests**: Tests for loading states, error handling, and no liquidity display

## Technical Details

### Stellar Integration
- Uses Stellar Horizon Testnet for development
- `strictSendPaths` endpoint for finding optimal swap routes
- Supports XLM (native) and any Stellar asset (e.g., USDC)

### Caching Strategy
- In-memory Map-based cache
- 60-second TTL (configurable)
- Cache key generated from source asset, destination asset, and amount

### API Endpoints
- Horizon Server: `https://horizon-testnet.stellar.org`

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import the project in Vercel
3. Vercel will automatically detect Next.js and configure the build
4. Deploy!

```bash
# Using Vercel CLI
npm i -g vercel
vercel
```

## Live Demo

[Demo Placeholder - Add your deployed URL here]

## Demo Video

[Video Placeholder - Add your demo video URL here]

## Technologies Used

- **Next.js** - React framework for production
- **Stellar SDK** - JavaScript SDK for Stellar blockchain
- **Jest** - Testing framework
- **CSS Modules** - Styling (built-in Next.js support)

## License

MIT License
