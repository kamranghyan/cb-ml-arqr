import type { MenuItem, MenuCategory, KdsOrder, AdminUser, QrTable } from './types';

// ─── Categories ──────────────────────────────────────────────────────────────

export const CATEGORIES: MenuCategory[] = [
  { id: 'all',     name: 'All',      emoji: '🍽️', itemCount: 84 },
  { id: 'starter', name: 'Starters', emoji: '🥗',  itemCount: 18 },
  { id: 'mains',   name: 'Mains',    emoji: '🍖',  itemCount: 22 },
  { id: 'pasta',   name: 'Pasta',    emoji: '🍝',  itemCount: 10 },
  { id: 'seafood', name: 'Seafood',  emoji: '🐟',  itemCount: 14 },
  { id: 'desserts',name: 'Desserts', emoji: '🍰',  itemCount: 12 },
  { id: 'drinks',  name: 'Drinks',   emoji: '🥤',  itemCount: 8  },
];

// ─── Menu Items ──────────────────────────────────────────────────────────────

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'wagyu-tenderloin',
    name: 'Wagyu Tenderloin',
    subtitle: '28-day dry-aged · Signature Preparation',
    category: 'mains',
    price: 4200,
    description:
      'A masterpiece of slow-aging and precision cooking. Our Wagyu tenderloin is sourced from grade A5 cattle, dry-aged for 28 days to develop deep umami complexity. Served with black truffle jus, pomme purée, and seasonal micro-herbs.',
    emoji: '🥩',
    rating: 4.8,
    reviewCount: 214,
    prepTime: '25–30 min',
    calories: 680,
    protein: 52,
    fat: 38,
    carbs: 8,
    allergens: [
      { name: 'Dairy',       emoji: '🥛', status: 'present' },
      { name: 'Gluten-Free', emoji: '🌾', status: 'free' },
      { name: 'Nut-Free',    emoji: '🥜', status: 'free' },
      { name: 'Sulphites',   emoji: '🧅', status: 'present' },
      { name: 'Fish-Free',   emoji: '🐟', status: 'free' },
      { name: 'Egg-Free',    emoji: '🥚', status: 'free' },
    ],
    tags: ['chef', 'popular'],
    status: 'active',
    customisations: {
      doneness: ['Rare', 'Medium Rare', 'Medium', 'Well Done'],
      sides:    ['Pomme Purée', 'Seasonal Veg', 'Fries'],
      sauces:   ['Truffle Jus', 'Peppercorn', 'Béarnaise'],
    },
  },
  {
    id: 'lobster-thermidor',
    name: 'Lobster Thermidor',
    subtitle: 'Grilled half lobster · Cognac cream',
    category: 'seafood',
    price: 5800,
    description:
      'Grilled half lobster with a rich cognac cream sauce, finished with gruyère gratin. A timeless classic executed with precision.',
    emoji: '🦞',
    rating: 4.7,
    reviewCount: 89,
    prepTime: '30–35 min',
    calories: 520,
    protein: 48,
    fat: 32,
    carbs: 6,
    allergens: [
      { name: 'Dairy',       emoji: '🥛', status: 'present' },
      { name: 'Shellfish',   emoji: '🦐', status: 'present' },
      { name: 'Gluten-Free', emoji: '🌾', status: 'free' },
      { name: 'Nut-Free',    emoji: '🥜', status: 'free' },
    ],
    tags: ['popular'],
    status: 'active',
  },
  {
    id: 'burrata-caprese',
    name: 'Burrata Caprese',
    subtitle: 'Heirloom tomatoes · Basil oil',
    category: 'starter',
    price: 950,
    description:
      'Fresh burrata with heirloom tomatoes, hand-torn basil, and cold-pressed basil oil. Simple, honest, exceptional.',
    emoji: '🧀',
    rating: 4.6,
    reviewCount: 176,
    prepTime: '10 min',
    calories: 280,
    protein: 14,
    fat: 22,
    carbs: 8,
    allergens: [
      { name: 'Dairy',     emoji: '🥛', status: 'present' },
      { name: 'Nut-Free',  emoji: '🥜', status: 'free' },
      { name: 'Fish-Free', emoji: '🐟', status: 'free' },
      { name: 'Egg-Free',  emoji: '🥚', status: 'free' },
    ],
    tags: ['veg', 'popular'],
    status: 'active',
  },
  {
    id: 'wild-mushroom-risotto',
    name: 'Wild Mushroom Risotto',
    subtitle: 'Porcini · Truffle oil · Parmesan',
    category: 'pasta',
    price: 1950,
    description:
      'Arborio rice slow-cooked with porcini mushrooms, finished with white truffle oil and aged parmesan.',
    emoji: '🍄',
    rating: 4.5,
    reviewCount: 143,
    prepTime: '20–25 min',
    calories: 420,
    protein: 12,
    fat: 18,
    carbs: 58,
    allergens: [
      { name: 'Dairy',     emoji: '🥛', status: 'present' },
      { name: 'Nut-Free',  emoji: '🥜', status: 'free' },
      { name: 'Fish-Free', emoji: '🐟', status: 'free' },
    ],
    tags: ['veg', 'new'],
    status: 'draft',
  },
  {
    id: 'chocolate-fondant',
    name: 'Chocolate Fondant',
    subtitle: 'Belgian chocolate · Vanilla ice cream',
    category: 'desserts',
    price: 780,
    description:
      'Warm Belgian chocolate fondant with a molten centre, served with house-made vanilla bean ice cream.',
    emoji: '🍫',
    rating: 4.9,
    reviewCount: 201,
    prepTime: '15 min',
    calories: 480,
    protein: 8,
    fat: 28,
    carbs: 52,
    allergens: [
      { name: 'Dairy',    emoji: '🥛', status: 'present' },
      { name: 'Gluten',   emoji: '🌾', status: 'present' },
      { name: 'Eggs',     emoji: '🥚', status: 'present' },
      { name: 'Nut-Free', emoji: '🥜', status: 'free' },
    ],
    tags: ['veg'],
    status: 'active',
  },
  {
    id: 'caesar-salad',
    name: 'Caesar Salad',
    subtitle: 'Romaine · House dressing · Croutons',
    category: 'starter',
    price: 650,
    description:
      'Classic Caesar with crisp romaine, house-made dressing, white anchovies, and sourdough croutons.',
    emoji: '🥗',
    rating: 4.3,
    reviewCount: 98,
    prepTime: '10 min',
    calories: 320,
    protein: 10,
    fat: 22,
    carbs: 24,
    allergens: [
      { name: 'Dairy',   emoji: '🥛', status: 'present' },
      { name: 'Gluten',  emoji: '🌾', status: 'present' },
      { name: 'Eggs',    emoji: '🥚', status: 'present' },
      { name: 'Fish',    emoji: '🐟', status: 'present' },
    ],
    tags: ['veg', 'popular'],
    status: 'inactive',
  },
  {
    id: 'rack-of-lamb',
    name: 'Rack of Lamb',
    subtitle: 'Herb-crusted · Rosemary jus',
    category: 'mains',
    price: 3600,
    description:
      'Herb-crusted rack of lamb with rosemary jus, dauphinoise potato, and seasonal greens.',
    emoji: '🍖',
    rating: 4.6,
    reviewCount: 112,
    prepTime: '30–35 min',
    calories: 620,
    protein: 48,
    fat: 42,
    carbs: 10,
    allergens: [
      { name: 'Dairy',     emoji: '🥛', status: 'present' },
      { name: 'Gluten',    emoji: '🌾', status: 'present' },
      { name: 'Nut-Free',  emoji: '🥜', status: 'free' },
      { name: 'Fish-Free', emoji: '🐟', status: 'free' },
    ],
    tags: ['spicy', 'new'],
    status: 'active',
  },
  {
    id: 'grilled-sea-bass',
    name: 'Grilled Sea Bass',
    subtitle: 'Lemon caper butter · Saffron',
    category: 'seafood',
    price: 2800,
    description:
      'Whole grilled sea bass with lemon caper butter, wilted spinach, and a saffron velouté.',
    emoji: '🐟',
    rating: 4.7,
    reviewCount: 134,
    prepTime: '20–25 min',
    calories: 380,
    protein: 42,
    fat: 18,
    carbs: 6,
    allergens: [
      { name: 'Dairy',    emoji: '🥛', status: 'present' },
      { name: 'Fish',     emoji: '🐟', status: 'present' },
      { name: 'Nut-Free', emoji: '🥜', status: 'free' },
      { name: 'Egg-Free', emoji: '🥚', status: 'free' },
    ],
    tags: ['popular'],
    status: 'active',
  },
];

// Chef's specials (shown in featured carousel)
export const FEATURED_ITEMS = MENU_ITEMS.filter((i) =>
  i.tags.includes('chef') || i.id === 'lobster-thermidor' || i.id === 'wild-mushroom-risotto'
);

// ─── KDS Orders ──────────────────────────────────────────────────────────────

export const INITIAL_KDS_ORDERS: KdsOrder[] = [
  {
    id: 'LM-2847', table: '07', zone: 'Main Hall',
    status: 'new', elapsedSeconds: 180, maxSeconds: 1800,
    items: [
      { emoji: '🥩', name: 'Wagyu Tenderloin', mods: 'Medium Rare · Truffle Jus', qty: 1, done: false },
      { emoji: '🧀', name: 'Burrata Caprese',  mods: 'Classic',                   qty: 2, done: true  },
      { emoji: '🍫', name: 'Chocolate Fondant',mods: 'With ice cream',             qty: 1, done: false },
    ],
    note: 'Guest allergic to nuts — please confirm',
    placedAt: '9:46 PM',
  },
  {
    id: 'LM-2848', table: '03', zone: 'Main Hall',
    status: 'preparing', elapsedSeconds: 840, maxSeconds: 1500,
    items: [
      { emoji: '🦞', name: 'Lobster Thermidor', mods: 'Grilled · Cognac cream', qty: 1, done: false },
      { emoji: '🥗', name: 'Caesar Salad',       mods: 'Extra anchovies',        qty: 1, done: true  },
    ],
    note: '',
    placedAt: '9:41 PM',
  },
  {
    id: 'LM-2849', table: '11', zone: 'Main Hall',
    status: 'ready', elapsedSeconds: 1440, maxSeconds: 1500,
    items: [
      { emoji: '🍄', name: 'Wild Mushroom Risotto', mods: 'No parmesan',    qty: 2, done: true },
      { emoji: '🥤', name: 'Sparkling Water',         mods: '500ml bottle', qty: 3, done: true },
    ],
    note: '',
    placedAt: '9:36 PM',
  },
  {
    id: 'LM-2850', table: '05', zone: 'Main Hall',
    status: 'new', elapsedSeconds: 60, maxSeconds: 1200,
    items: [
      { emoji: '🍖', name: 'Rack of Lamb',      mods: 'Well done · Rosemary jus', qty: 2, done: false },
      { emoji: '🧀', name: 'Burrata Caprese',   mods: 'No basil',                  qty: 1, done: false },
    ],
    note: '',
    placedAt: '9:53 PM',
  },
  {
    id: 'LM-2845', table: '02', zone: 'Main Hall',
    status: 'preparing', elapsedSeconds: 1080, maxSeconds: 1200,
    items: [
      { emoji: '🐟', name: 'Grilled Sea Bass', mods: 'Lemon butter · Saffron', qty: 1, done: false },
    ],
    note: '',
    placedAt: '9:38 PM',
  },
  {
    id: 'LM-2844', table: '09', zone: 'Main Hall',
    status: 'delivered', elapsedSeconds: 1680, maxSeconds: 1500,
    items: [
      { emoji: '🍝', name: 'Pasta Carbonara', mods: 'Extra guanciale', qty: 2, done: true },
    ],
    note: '',
    placedAt: '9:30 PM',
  },
];

// ─── Admin Users ─────────────────────────────────────────────────────────────

export const ADMIN_USERS: AdminUser[] = [
  { id: '1', initials: 'SA', name: 'Super Admin',   email: 'admin@lamaison.pk',  role: 'super',   mfaEnabled: true,  isOnline: true,  lastLogin: 'Just now'   },
  { id: '2', initials: 'AR', name: 'Ahmed Raza',    email: 'ahmed@lamaison.pk',  role: 'manager', mfaEnabled: true,  isOnline: true,  lastLogin: '5 min ago'  },
  { id: '3', initials: 'SF', name: 'Sara Farooq',   email: 'sara@lamaison.pk',   role: 'manager', mfaEnabled: true,  isOnline: false, lastLogin: '2 hrs ago'  },
  { id: '4', initials: 'MK', name: 'M. Kamran',     email: 'kamran@lamaison.pk', role: 'kitchen', mfaEnabled: false, isOnline: true,  lastLogin: 'Just now'   },
  { id: '5', initials: 'ZA', name: 'Zara Akram',    email: 'zara@lamaison.pk',   role: 'kitchen', mfaEnabled: true,  isOnline: false, lastLogin: 'Yesterday'  },
  { id: '6', initials: 'IH', name: 'Imran Hussain', email: 'imran@lamaison.pk',  role: 'kitchen', mfaEnabled: false, isOnline: false, lastLogin: '3 days ago' },
];

// ─── QR Tables ───────────────────────────────────────────────────────────────

export const QR_TABLES: QrTable[] = Array.from({ length: 12 }, (_, i) => {
  const num = String(i + 1).padStart(2, '0');
  return {
    tableNumber: num,
    zone: 'Main Hall',
    outlet: 'main-hall',
    linked: ![9, 10].includes(i + 1),
    url: `https://menu.lamaison.pk/t/main-hall/${num}`,
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const formatPrice = (price: number | undefined | null): string => {
  if (price == null || isNaN(Number(price))) return 'Rs —';
  return 'Rs ' + Number(price).toLocaleString('en-PK');
};