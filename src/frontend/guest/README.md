# 🍽️ Das Pardes — Restaurant Digital Menu System

A full-stack restaurant PWA built with **Next.js 14**, **TypeScript**, and **Tailwind CSS**.

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── guest/                  # Guest PWA (customer-facing)
│   │   ├── page.tsx            # QR Scan Landing Page
│   │   ├── menu/
│   │   │   ├── page.tsx        # Menu Category Browser
│   │   │   └── [id]/page.tsx   # Item Detail + Allergens
│   │   ├── cart/page.tsx       # Cart Review & Order Placement
│   │   └── tracking/page.tsx   # Real-time Order Tracking
│   │
│   ├── admin/                  # Admin Dashboard
│   │   ├── layout.tsx          # Shared sidebar layout
│   │   ├── dashboard/page.tsx  # Overview & analytics
│   │   ├── menu/page.tsx       # Menu CRUD + image upload
│   │   ├── qr/page.tsx         # QR Code Management
│   │   └── users/page.tsx      # User Management (RBAC)
│   │
│   └── kds/page.tsx            # Kitchen Display System
│
├── components/
│   └── ui/index.tsx            # Shared UI components
│
└── lib/
    ├── types.ts                # TypeScript interfaces
    ├── data.ts                 # Mock data (replace with API calls)
    ├── store.ts                # Zustand cart store
    └── utils.ts                # Helpers: cn, formatPrice, etc.
```

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Run the development server
```bash
npm run dev
```

### 3. Open in browser

| App | URL |
|-----|-----|
| Guest PWA | http://localhost:3000/guest |
| Menu Browser | http://localhost:3000/guest/menu |
| Admin Dashboard | http://localhost:3000/admin/dashboard |
| Admin Menu | http://localhost:3000/admin/menu |
| Admin QR Codes | http://localhost:3000/admin/qr |
| Admin Users | http://localhost:3000/admin/users |
| Kitchen Display | http://localhost:3000/kds |

---

## 🎨 Design System

- **Colors:** Deep charcoal (`#ffffff`) with warm amber/gold (`#14b8a6`) accents
- **Typography:** Playfair Display (serif) + DM Sans (body) + DM Mono (timers/IDs)
- **Theme:** Premium dark luxury — restaurant fine-dining ambiance

---

## 🔗 Backend Integration Points

Replace mock data in `src/lib/data.ts` with real API calls:

### Authentication (Amazon Cognito)
```ts
// Guest: anonymous JWT
const { accessToken } = await Auth.currentSession();

// Admin: MFA-protected login
await Auth.signIn(username, password);
```

### Menu API (AWS AppSync / REST)
```ts
// Fetch menu items
const items = await fetch('/api/menu?outlet=main-hall').then(r => r.json());

// Create/update item
await fetch('/api/menu/items', { method: 'POST', body: JSON.stringify(item) });
```

### S3 Image Upload (Presigned POST)
```ts
// Get presigned URL from backend
const { url, fields } = await fetch('/api/upload/presign').then(r => r.json());

// Upload directly to S3
const form = new FormData();
Object.entries(fields).forEach(([k, v]) => form.append(k, v as string));
form.append('file', imageFile);
await fetch(url, { method: 'POST', body: form });
```

### WebSocket (Order Tracking)
```ts
// Connect to AWS API Gateway WebSocket
const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);
ws.onmessage = ({ data }) => {
  const { orderId, status } = JSON.parse(data);
  updateOrderStatus(orderId, status);
};
```

### REST Polling (fallback every 10s)
```ts
useEffect(() => {
  const id = setInterval(async () => {
    const status = await fetch(`/api/orders/${orderId}/status`).then(r => r.json());
    setStatus(status);
  }, 10_000);
  return () => clearInterval(id);
}, [orderId]);
```

### QR Code Generation
```ts
import QRCode from 'qrcode';
const url = `https://menu.lamaison.pk/t/${outlet}/${tableNumber}`;
const qrDataUrl = await QRCode.toDataURL(url);
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| State | Zustand |
| Auth | Amazon Cognito |
| API | AWS AppSync (GraphQL) + REST |
| Realtime | WebSocket API + REST polling |
| Storage | Amazon S3 (presigned uploads) |
| CDN | Amazon CloudFront |
| CI/CD | AWS CodePipeline |
| Analytics | Amazon QuickSight |

---

## 📱 PWA Features

- Installable on iOS and Android
- Offline-capable via Workbox service worker
- `manifest.json` configured for standalone display
- Mobile-first responsive design

---

## 🔐 Role-Based Access

| Role | Permissions |
|------|-------------|
| Super Admin | Full access — users, menu, QR, analytics |
| Manager | Menu CRUD, QR, orders — no user management |
| Kitchen Staff | KDS only — order status updates |
