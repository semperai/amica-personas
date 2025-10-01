// src/app/create/page.tsx - Server Component
import CreatePageClient from './components/CreatePageClient';

export const metadata = {
  title: 'Create Persona - Amica',
  description: 'Create a new AI persona with custom metadata and trading features',
};

export default function CreatePage() {
  return <CreatePageClient />;
}
