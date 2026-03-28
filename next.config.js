/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // StellarWalletsKit ships ESM-only packages — transpile them for Next.js
  transpilePackages: [
    '@creit.tech/stellar-wallets-kit',
    '@creit.tech/xbull-wallet-connect',
  ],

  // SEP-0001: Serve stellar.toml with required CORS and content-type headers
  async headers() {
    return [
      {
        source: '/.well-known/stellar.toml',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
