import { Suspense } from 'react';
import ItemDetailClient from './ItemDetailClient';

export default function ItemPage() {
  return (
    <Suspense fallback={null}>
      <ItemDetailClient />
    </Suspense>
  );
}