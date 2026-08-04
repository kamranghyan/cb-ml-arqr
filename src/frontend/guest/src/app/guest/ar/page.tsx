import ARPageClient from './ARPageClient';

interface Props {
  searchParams: Promise<{
    rid?:   string;
    iid?:   string;
    name?:  string;
    emoji?: string;
    url?:   string;
  }>;
}

export default async function ARPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <ARPageClient
      restaurantId={params.rid?.trim()     ?? ''}
      itemId={params.iid?.trim()           ?? ''}
      itemName={params.name                ?? 'Menu Item'}
      emoji={params.emoji                  ?? '🍽️'}
      preloadedGlbUrl={params.url?.trim()  ?? ''}
    />
  );
}