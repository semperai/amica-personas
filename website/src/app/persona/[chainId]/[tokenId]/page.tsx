// src/app/persona/[chainId]/[tokenId]/page.tsx - Server Component
import PersonaPageClient from './components/PersonaPageClient';

export const metadata = {
  title: 'Persona Details - Amica',
  description: 'View and trade persona tokens',
};

export default function PersonaPage() {
  return <PersonaPageClient />;
}
