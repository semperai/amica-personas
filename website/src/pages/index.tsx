import Layout from '@/components/Layout';
import { PersonaList } from '@/components/PersonaList';
import { TrendingPersonas } from '@/components/TrendingPersonas';

export default function Home() {
  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Welcome to Amica Personas</h1>
        <p className="text-xl text-gray-600">
          Create, trade, and discover AI personas on multiple chains
        </p>
      </div>
      
      <TrendingPersonas />
      <PersonaList />
    </Layout>
  );
}
