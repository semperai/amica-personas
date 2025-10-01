// src/app/convert/page.tsx
import ConvertPageClient from './components/ConvertPageClient';

export const metadata = {
  title: 'AIUS to AMICA Converter - Amica',
  description: 'Convert your AIUS tokens to AMICA and join the Amica ecosystem',
};

export default function ConvertPage() {
  return <ConvertPageClient />;
}
