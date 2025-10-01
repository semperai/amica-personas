// src/app/portfolio/page.tsx - Server Component
import PortfolioPageClient from './components/PortfolioPageClient';

export const metadata = {
  title: 'Portfolio - Amica',
  description: 'View your persona tokens, AMICA balance, and trading history',
};

export default function PortfolioPage() {
  return <PortfolioPageClient />;
}
