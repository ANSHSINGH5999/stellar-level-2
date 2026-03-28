import dynamic from 'next/dynamic';

const BackgroundAnimation = dynamic(
  () => import('../components/BackgroundAnimation'),
  { ssr: false }
);

const PaymentTrackerApp = dynamic(
  () => import('../components/PaymentTrackerApp'),
  { ssr: false }
);

export default function Home() {
  return (
    <>
      <BackgroundAnimation />
      <PaymentTrackerApp />
    </>
  );
}
