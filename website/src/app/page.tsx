// src/app/page.tsx - Server Component
import HomePageClient from './components/HomePageClient';

export const metadata = {
  title: 'Amica Personas - Create Your AI Persona',
  description: 'Launch, trade, and monetize autonomous AI agents on the blockchain',
};

export default function HomePage() {
  return <HomePageClient />;
}
