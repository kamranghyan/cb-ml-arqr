import ARPageClient from './ARPageClient';

interface Props {
  searchParams: Promise<{
    rid?: string;
    iid?: string;
    name?: string;
    emoji?: string;
    url?: string;
    imageUrl?: string;
  }>;
}

export default async function ARPage({ searchParams }: Props) {
  const params = await searchParams;

  const restaurantId = params.rid ?? '';
  const itemId = params.iid ?? '';
  const itemName = params.name ?? 'Menu Item';
  const emoji = params.emoji ?? '🍽️';
  const imageUrl = params.imageUrl ?? '';
  const glbUrl = params.url ?? '';

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