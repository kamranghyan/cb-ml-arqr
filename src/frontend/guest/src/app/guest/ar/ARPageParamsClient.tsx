'use client';

import { useSearchParams } from 'next/navigation';
import ARPageClient from './ARPageClient';

export default function ARPageParamsClient() {
  const searchParams = useSearchParams();

  const restaurantId = searchParams.get('rid') ?? '';
  const itemId = searchParams.get('iid') ?? '';
  const itemName = searchParams.get('name') ?? 'Menu Item';
  const emoji = searchParams.get('emoji') ?? '🍽️';
  const imageUrl = searchParams.get('imageUrl') ?? '';
  const glbUrl = searchParams.get('url') ?? '';

  return (
    <ARPageClient
      restaurantId={restaurantId}
      itemId={itemId}
      itemName={itemName}
      emoji={emoji}
      imageUrl={imageUrl}
      preloadedGlbUrl={glbUrl}
    />
  );
}