import { Suspense } from 'react';
import ARPageParamsClient from './ARPageParamsClient';

export default function ARPage() {
  return (
    <Suspense fallback={null}>
      <ARPageParamsClient />
    </Suspense>
  );
}