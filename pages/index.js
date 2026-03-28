import dynamic from 'next/dynamic';

// All wallet/blockchain APIs are browser-only — disable SSR
const PaymentTrackerApp = dynamic(
  () => import('../components/PaymentTrackerApp'),
  { ssr: false }
);

export default function Home() {
  return <PaymentTrackerApp />;
}
