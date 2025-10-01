// src/app/staking/page.tsx - Server Component
import StakingPageClient from './components/StakingPageClient';

export const metadata = {
  title: 'Staking - Amica',
  description: 'Stake your LP tokens to earn rewards',
};

export default function StakingPage() {
  return <StakingPageClient />;
}
