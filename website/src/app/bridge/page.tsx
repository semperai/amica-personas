// src/app/bridge/page.tsx - Server Component
import BridgePageClient from './components/BridgePageClient';

export const metadata = {
  title: 'Bridge - Amica',
  description: 'Bridge AMICA tokens across chains',
};

export default function BridgePage() {
  return <BridgePageClient />;
}
