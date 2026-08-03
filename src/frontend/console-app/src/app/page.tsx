import { redirect } from 'next/navigation';

// The middleware normally redirects by role before this renders; this is the
// fallback for anyone arriving without a session.
export default function RootPage() {
  redirect('/login');
}
